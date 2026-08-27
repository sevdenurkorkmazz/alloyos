"""AlloyOS iteration-2 tests: Meetings/Calendar + per-agent auto_approve."""
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = f"{base_url.rstrip('/')}/api"


# ----------------------------- fixtures ------------------------------------
@pytest.fixture(scope="module")
def creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*[-*]?\s*Email\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*[-*]?\s*Password\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("credentials not parsed")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def h(client, creds):
    r = client.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def employees(client, h):
    r = client.get(f"{API}/employees", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    emps = r.json()
    assert len(emps) >= 2, "need at least 2 employees in demo company"
    return emps


@pytest.fixture(scope="module")
def created_meetings(client, h):
    ids = []
    yield ids
    for mid in ids:
        client.delete(f"{API}/meetings/{mid}", headers=h, timeout=30)


def emp_status(client, h, eid):
    r = client.get(f"{API}/employees/{eid}", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["status"]


# ----------------------------- Meetings module -----------------------------
class TestMeetingsImmediate:
    def test_create_immediate_meeting(self, client, h, employees, created_meetings):
        parts = [e["id"] for e in employees[:3]]
        r = client.post(f"{API}/meetings", headers=h, json={
            "title": "TEST_Standup Now", "participants": parts,
            "start_time": None, "duration_seconds": 120}, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()
        created_meetings.append(m["id"])
        assert "_id" not in m
        assert m["status"] == "active"
        assert m["title"] == "TEST_Standup Now"
        assert sorted(m["seat_map"].keys()) == sorted(parts)
        assert all(isinstance(v, int) and 0 <= v < 6 for v in m["seat_map"].values())
        assert isinstance(m["end_ts"], (int, float)) and m["end_ts"] > time.time()

        # participants flipped to 'meeting'
        for pid in parts:
            assert emp_status(client, h, pid) == "meeting", f"{pid} not in meeting status"

        # GET list contains it
        lst = client.get(f"{API}/meetings", headers=h, timeout=30).json()
        assert any(x["id"] == m["id"] and x["status"] == "active" for x in lst)

        # meeting start event emitted
        ev = client.get(f"{API}/events", headers=h, timeout=30)
        assert ev.status_code == 200, ev.text
        evs = ev.json()["events"]
        starts = [e for e in evs if e.get("type") == "meeting"
                  and e.get("payload", {}).get("meeting_id") == m["id"]
                  and e.get("payload", {}).get("action") == "start"]
        assert starts, f"no meeting start event found; sample={evs[:2]}"
        assert starts[0]["payload"]["seat_map"]

        # end it
        er = client.post(f"{API}/meetings/{m['id']}/end", headers=h, timeout=30)
        assert er.status_code == 200, er.text
        lst = client.get(f"{API}/meetings", headers=h, timeout=30).json()
        got = [x for x in lst if x["id"] == m["id"]][0]
        assert got["status"] == "done"
        for pid in parts:
            assert emp_status(client, h, pid) == "idle", f"{pid} not reverted to idle"

    def test_participants_capped_at_six(self, client, h, employees, created_meetings):
        if len(employees) < 7:
            pytest.skip("need 7+ employees to test cap")
        parts = [e["id"] for e in employees[:7]]
        r = client.post(f"{API}/meetings", headers=h, json={
            "title": "TEST_Cap", "participants": parts, "duration_seconds": 30}, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()
        created_meetings.append(m["id"])
        assert len(m["participants"]) == 6
        client.post(f"{API}/meetings/{m['id']}/end", headers=h, timeout=30)

    def test_start_and_end_404(self, client, h):
        assert client.post(f"{API}/meetings/nope/start", headers=h, timeout=30).status_code == 404
        assert client.post(f"{API}/meetings/nope/end", headers=h, timeout=30).status_code == 404

    def test_meetings_require_auth(self, client):
        assert client.get(f"{API}/meetings", timeout=30).status_code in (401, 403)


class TestMeetingScheduler:
    def test_near_future_meeting_auto_activates_then_auto_ends(self, client, h, employees, created_meetings):
        parts = [e["id"] for e in employees[:2]]
        start = (datetime.now(timezone.utc) + timedelta(seconds=3)).isoformat()
        r = client.post(f"{API}/meetings", headers=h, json={
            "title": "TEST_Scheduled", "participants": parts,
            "start_time": start, "duration_seconds": 20}, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()
        created_meetings.append(m["id"])
        assert m["status"] == "scheduled"

        def status_of(mid):
            lst = client.get(f"{API}/meetings", headers=h, timeout=30).json()
            hit = [x for x in lst if x["id"] == mid]
            return hit[0]["status"] if hit else None

        # auto-activate within ~15s
        deadline = time.time() + 20
        while time.time() < deadline and status_of(m["id"]) != "active":
            time.sleep(2)
        assert status_of(m["id"]) == "active", "scheduler did not activate meeting"
        assert emp_status(client, h, parts[0]) == "meeting"

        # auto-end after duration_seconds (20s) + scheduler tick
        deadline = time.time() + 45
        while time.time() < deadline and status_of(m["id"]) != "done":
            time.sleep(3)
        assert status_of(m["id"]) == "done", "scheduler did not auto-end meeting"
        for pid in parts:
            assert emp_status(client, h, pid) == "idle"


# ----------------------------- auto_approve module -------------------------
def wait_task(client, h, tid, statuses, timeout=60):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = client.get(f"{API}/tasks", headers=h, timeout=30)
        hit = [t for t in r.json() if t["id"] == tid]
        if hit:
            last = hit[0]
            if last["status"] in statuses:
                return last
        time.sleep(2)
    return last


class TestAutoApprove:
    def test_create_agent_with_auto_approve_persists(self, client, h):
        r = client.post(f"{API}/employees/ai", headers=h, json={
            "name": "TEST_AutoBot", "role": "Copywriter",
            "skills": ["Copy"], "auto_approve": True,
            "system_instructions": "Answer in under 40 words."}, timeout=30)
        assert r.status_code == 200, r.text
        agent = r.json()
        assert agent["auto_approve"] is True
        got = client.get(f"{API}/employees/{agent['id']}", headers=h, timeout=30).json()
        assert got["auto_approve"] is True
        TestAutoApprove.agent = agent

    def test_task_completes_without_pending_approval(self, client, h):
        agent = TestAutoApprove.agent
        before = client.get(f"{API}/employees/{agent['id']}", headers=h, timeout=30).json()
        before_done = (before.get("stats") or {}).get("completed", 0)

        r = client.post(f"{API}/tasks", headers=h, json={
            "title": "TEST_AutoApprove Task", "description": "Write one tagline for a coffee brand.",
            "assigned_to": agent["id"], "priority": "medium"}, timeout=30)
        assert r.status_code == 200, r.text
        task = r.json()

        final = wait_task(client, h, task["id"], {"completed", "review"}, timeout=90)
        assert final is not None
        assert final["status"] == "completed", f"expected completed, got {final['status']}"
        assert final.get("output"), "no LLM output saved"
        assert "[AI execution error]" not in final["output"], final["output"][:300]

        # no pending approval for this task
        apps = client.get(f"{API}/approvals", headers=h, timeout=30).json()
        pending = [a for a in apps if a["task_id"] == task["id"] and a["status"] == "pending"]
        assert not pending, f"auto-approve created a pending approval: {pending}"

        # stats incremented, agent back to idle
        after = client.get(f"{API}/employees/{agent['id']}", headers=h, timeout=30).json()
        assert (after.get("stats") or {}).get("completed", 0) == before_done + 1
        assert after["status"] == "idle"

    def test_auto_approve_off_still_goes_to_review(self, client, h):
        r = client.post(f"{API}/employees/ai", headers=h, json={
            "name": "TEST_ManualBot", "role": "Analyst", "skills": ["Analysis"],
            "system_instructions": "Answer in under 40 words."}, timeout=30)
        assert r.status_code == 200, r.text
        agent = r.json()
        assert agent.get("auto_approve") is False

        t = client.post(f"{API}/tasks", headers=h, json={
            "title": "TEST_Manual Review Task", "description": "List 2 risks of remote work.",
            "assigned_to": agent["id"]}, timeout=30).json()
        final = wait_task(client, h, t["id"], {"review", "completed"}, timeout=90)
        assert final["status"] == "review", f"expected review, got {final['status']}"
        apps = client.get(f"{API}/approvals", headers=h, timeout=30).json()
        pending = [a for a in apps if a["task_id"] == t["id"] and a["status"] == "pending"]
        assert pending, "no pending approval created for non-auto-approve agent"
        assert client.get(f"{API}/employees/{agent['id']}", headers=h,
                          timeout=30).json()["status"] == "waiting"

    def test_toggle_auto_approve_on_existing_agent(self, client, h):
        r = client.post(f"{API}/employees/ai", headers=h, json={
            "name": "TEST_ToggleBot", "role": "Ops"}, timeout=30)
        agent = r.json()
        assert agent.get("auto_approve") is False
        up = client.put(f"{API}/employees/{agent['id']}", headers=h,
                        json={"auto_approve": True}, timeout=30)
        assert up.status_code == 200, up.text
        assert up.json()["auto_approve"] is True
        got = client.get(f"{API}/employees/{agent['id']}", headers=h, timeout=30).json()
        assert got["auto_approve"] is True
        up2 = client.put(f"{API}/employees/{agent['id']}", headers=h,
                         json={"auto_approve": False}, timeout=30)
        assert up2.status_code == 200
        assert client.get(f"{API}/employees/{agent['id']}", headers=h,
                          timeout=30).json()["auto_approve"] is False
