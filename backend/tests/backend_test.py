"""AlloyOS backend API regression tests (pytest)."""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


# ----------------------------- fixtures ------------------------------------
@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*[-*]?\s*Email\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*[-*]?\s*Password\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("credentials not parsed")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(client, test_credentials):
    r = client.post(f"{API}/auth/login", json=test_credentials, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    assert "token" in data and data["user"]["email"] == test_credentials["email"]
    return {"token": data["token"], "user": data["user"], "company": data["company"]}


@pytest.fixture(scope="session")
def h(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def ai_agent(client, h):
    r = client.post(f"{API}/employees/ai", headers=h, json={
        "name": "TEST_Aria", "role": "Research Analyst",
        "skills": ["Web research"], "personality": "Rigorous",
        "system_instructions": "You are a research analyst. Be brief."}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def human_emp(client, h):
    r = client.post(f"{API}/employees/human", headers=h, json={
        "name": "TEST_Human", "role": "Designer",
        "email": "TEST_h@qamail.example.com"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def project(client, h):
    r = client.post(f"{API}/projects", headers=h,
                    json={"name": "TEST_Launch", "description": "qa"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="class")
def state():
    return {}


# ----------------------------- Auth module ---------------------------------
class TestAuth:
    def test_register_new_company(self, client):
        email = f"test_qa_{uuid.uuid4().hex[:8]}@qamail.example.com"
        r = client.post(f"{API}/auth/register", json={
            "name": "QA Owner", "email": email, "password": "qapass1234",
            "company_name": "TEST_QA Corp"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 10
        assert d["user"]["email"] == email
        assert d["company"]["name"] == "TEST_QA Corp"
        assert "_id" not in d["company"]
        hdr = {"Authorization": f"Bearer {d['token']}"}
        # default departments + CEO employee
        deps = client.get(f"{API}/departments", headers=hdr, timeout=30).json()
        assert len(deps) == 6
        emps = client.get(f"{API}/employees", headers=hdr, timeout=30).json()
        assert len(emps) == 1 and emps[0]["role"] == "CEO"
        pytest.registered = {"token": d["token"], "user": d["user"]}

    def test_register_duplicate_email(self, client, test_credentials):
        r = client.post(f"{API}/auth/register", json={
            "name": "Dup", "email": test_credentials["email"], "password": "x1234567",
            "company_name": "Dup Co"}, timeout=30)
        assert r.status_code == 400

    def test_login_invalid(self, client, test_credentials):
        r = client.post(f"{API}/auth/login", json={
            "email": test_credentials["email"], "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401

    def test_me(self, client, h, auth):
        r = client.get(f"{API}/auth/me", headers=h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["id"] == auth["user"]["id"]
        assert d["company"]["id"] == auth["user"]["company_id"]

    def test_me_unauthenticated(self, client):
        assert client.get(f"{API}/auth/me", timeout=30).status_code == 401

    def test_me_invalid_token(self, client):
        r = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer bogus.token.xyz"}, timeout=30)
        assert r.status_code == 401

    def test_bcrypt_hash_format(self, test_credentials):
        import pymongo
        from dotenv import dotenv_values as dv
        env = dv("/app/backend/.env")
        c = pymongo.MongoClient(env["MONGO_URL"])
        u = c[env["DB_NAME"]].users.find_one({"email": test_credentials["email"]})
        assert u and u["password_hash"].startswith("$2b$"), u["password_hash"][:10] if u else "no user"


# ----------------------------- Departments ---------------------------------
class TestDepartments:
    def test_list_and_create(self, client, h):
        before = client.get(f"{API}/departments", headers=h, timeout=30).json()
        r = client.post(f"{API}/departments", headers=h,
                        json={"name": "TEST_Legal", "color": "#ff0000"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Legal" and "_id" not in d
        after = client.get(f"{API}/departments", headers=h, timeout=30).json()
        assert len(after) == len(before) + 1
        assert any(x["id"] == d["id"] for x in after)


# ----------------------------- Employees -----------------------------------
class TestEmployees:
    def test_agent_templates(self, client, h):
        r = client.get(f"{API}/agent-templates", headers=h, timeout=30)
        assert r.status_code == 200
        t = r.json()
        assert len(t) >= 6 and "system_instructions" in t[0]

    def test_create_ai_agent_and_persist(self, client, h, ai_agent):
        a = ai_agent
        assert a["type"] == "ai" and a["ai_model"]
        assert "desk" in a and "x" in a["desk"]
        g = client.get(f"{API}/employees/{a['id']}", headers=h, timeout=30)
        assert g.status_code == 200
        assert g.json()["name"] == "TEST_Aria"
        assert "task_summary" in g.json()

    def test_create_human(self, client, h, human_emp):
        d = human_emp
        assert d["type"] == "human" and d["invited"] is True
        lst = client.get(f"{API}/employees", headers=h, timeout=30).json()
        assert any(e["id"] == d["id"] for e in lst)

    def test_update_employee(self, client, h, human_emp):
        r = client.put(f"{API}/employees/{human_emp['id']}", headers=h,
                       json={"role": "Senior Designer"}, timeout=30)
        assert r.status_code == 200 and r.json()["role"] == "Senior Designer"
        g = client.get(f"{API}/employees/{human_emp['id']}", headers=h, timeout=30).json()
        assert g["role"] == "Senior Designer"

    def test_get_employee_404(self, client, h):
        assert client.get(f"{API}/employees/{uuid.uuid4()}", headers=h, timeout=30).status_code == 404

    def test_employees_require_auth(self, client):
        assert client.get(f"{API}/employees", timeout=30).status_code == 401


# ----------------------------- Projects ------------------------------------
class TestProjects:
    def test_create_and_list(self, client, h, project):
        p = project
        lst = client.get(f"{API}/projects", headers=h, timeout=30).json()
        mine = [x for x in lst if x["id"] == p["id"]]
        assert mine and isinstance(mine[0]["task_count"], int)


# ----------------------------- Tasks + AI chain ----------------------------
class TestTaskAIChain:
    def test_create_task_assigned_to_ai_runs_llm(self, client, h, ai_agent, project, state):
        r = client.post(f"{API}/tasks", headers=h, json={
            "title": "TEST_ List 3 AI market trends",
            "description": "Answer in max 3 bullet points.",
            "assigned_to": ai_agent["id"], "project_id": project["id"],
            "priority": "high"}, timeout=60)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "assigned"
        state["task_id"] = t["id"]

        # poll for review
        status, output = None, None
        deadline = time.time() + 90
        while time.time() < deadline:
            tasks = client.get(f"{API}/tasks", headers=h, timeout=30).json()
            cur = next((x for x in tasks if x["id"] == t["id"]), None)
            status, output = cur["status"], cur.get("output")
            if status == "review":
                break
            time.sleep(3)
        assert status == "review", f"task stuck in {status}"
        assert output and len(output) > 50, f"empty/short LLM output: {output!r}"
        assert not output.startswith("[AI execution error]"), output[:300]

    def test_project_task_count_increments(self, client, h, project):
        lst = client.get(f"{API}/projects", headers=h, timeout=30).json()
        p = next(x for x in lst if x["id"] == project["id"])
        assert p["task_count"] >= 1

    def test_events_contain_status_and_envelope(self, client, h):
        r = client.get(f"{API}/events?since=0", headers=h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        types = {e["type"] for e in d["events"]}
        assert "status" in types
        assert "envelope" in types, types
        assert isinstance(d["now"], float)

    def test_approval_pending_created(self, client, h, state):
        appr = client.get(f"{API}/approvals", headers=h, timeout=30).json()
        mine = [a for a in appr if a["task_id"] == state["task_id"]]
        assert mine, "no approval created for AI task"
        a = mine[0]
        assert a["status"] == "pending" and a["agent_name"] == "TEST_Aria"
        state["approval_id"] = a["id"]

    def test_reject_moves_task_to_assigned(self, client, h, state):
        r = client.post(f"{API}/approvals/{state['approval_id']}/decision", headers=h,
                        json={"decision": "reject"}, timeout=30)
        assert r.status_code == 200
        tasks = client.get(f"{API}/tasks", headers=h, timeout=30).json()
        cur = next(x for x in tasks if x["id"] == state["task_id"])
        assert cur["status"] == "assigned"

    def test_rerun_and_approve_completes(self, client, h, ai_agent, state):
        r = client.post(f"{API}/tasks/{state['task_id']}/run", headers=h, timeout=30)
        assert r.status_code == 200
        appr_id = None
        deadline = time.time() + 90
        while time.time() < deadline:
            appr = client.get(f"{API}/approvals", headers=h, timeout=30).json()
            pend = [a for a in appr if a["task_id"] == state["task_id"] and a["status"] == "pending"]
            if pend:
                appr_id = pend[0]["id"]
                break
            time.sleep(3)
        assert appr_id, "re-run did not produce a pending approval"
        before = client.get(f"{API}/employees/{ai_agent['id']}", headers=h, timeout=30).json()
        r = client.post(f"{API}/approvals/{appr_id}/decision", headers=h,
                        json={"decision": "approve"}, timeout=30)
        assert r.status_code == 200
        tasks = client.get(f"{API}/tasks", headers=h, timeout=30).json()
        cur = next(x for x in tasks if x["id"] == state["task_id"])
        assert cur["status"] == "completed"
        after = client.get(f"{API}/employees/{ai_agent['id']}", headers=h, timeout=30).json()
        assert after["stats"]["completed"] == before["stats"]["completed"] + 1
        assert after["status"] == "idle"

    def test_run_task_without_assignee_400(self, client, h, human_emp):
        t = client.post(f"{API}/tasks", headers=h, json={"title": "TEST_unassigned"}, timeout=30).json()
        assert t["status"] == "backlog"
        r = client.post(f"{API}/tasks/{t['id']}/run", headers=h, timeout=30)
        assert r.status_code == 400
        # update to assign to human -> becomes assigned
        u = client.put(f"{API}/tasks/{t['id']}", headers=h,
                       json={"assigned_to": human_emp["id"]}, timeout=30)
        assert u.status_code == 200 and u.json()["status"] == "assigned"
        assert client.delete(f"{API}/tasks/{t['id']}", headers=h, timeout=30).status_code == 200
        tasks = client.get(f"{API}/tasks", headers=h, timeout=30).json()
        assert not any(x["id"] == t["id"] for x in tasks)

    def test_update_task_404(self, client, h):
        r = client.put(f"{API}/tasks/{uuid.uuid4()}", headers=h, json={"title": "x"}, timeout=30)
        assert r.status_code == 404

    def test_approval_404(self, client, h):
        r = client.post(f"{API}/approvals/{uuid.uuid4()}/decision", headers=h,
                        json={"decision": "approve"}, timeout=30)
        assert r.status_code == 404


# ----------------------------- Messaging -----------------------------------
class TestMessaging:
    def test_send_message_and_conversation(self, client, h, auth, human_emp):
        emps = client.get(f"{API}/employees", headers=h, timeout=30).json()
        me = next(e for e in emps if e.get("user_id") == auth["user"]["id"])
        r = client.post(f"{API}/messages", headers=h, json={
            "from_employee": me["id"], "to_employee": human_emp["id"],
            "body": "TEST_hello there", "kind": "message"}, timeout=30)
        assert r.status_code == 200
        m = r.json()
        assert m["body"] == "TEST_hello there" and "_id" not in m
        thread = client.get(f"{API}/messages", headers=h,
                           params={"employee": me["id"], "with_employee": human_emp["id"]},
                           timeout=30).json()
        assert any(x["id"] == m["id"] for x in thread)
        convs = client.get(f"{API}/conversations", headers=h,
                          params={"employee": me["id"]}, timeout=30).json()
        assert any(c["employee_id"] == human_emp["id"] for c in convs)
        acts = client.get(f"{API}/activity", headers=h, timeout=30).json()
        assert any("sent a message" in a["text"] for a in acts)

    def test_notifications(self, client, h):
        r = client.get(f"{API}/notifications", headers=h, timeout=30)
        assert r.status_code == 200 and isinstance(r.json(), list)


# ----------------------------- Dashboard -----------------------------------
class TestDashboard:
    def test_stats_shape(self, client, h):
        r = client.get(f"{API}/dashboard/stats", headers=h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["employees"]["total"] == d["employees"]["ai"] + d["employees"]["human"]
        assert d["tasks"]["total"] >= 1
        assert d["projects"]["active"] >= 1
        assert d["agents"]["total"] >= 1


# ----------------------------- Multi-tenancy -------------------------------
class TestMultiTenant:
    def test_isolation(self, client, h, ai_agent):
        email = f"test_iso_{uuid.uuid4().hex[:8]}@qamail.example.com"
        d = client.post(f"{API}/auth/register", json={
            "name": "Iso", "email": email, "password": "isopass1234",
            "company_name": "TEST_Iso Co"}, timeout=30).json()
        h2 = {"Authorization": f"Bearer {d['token']}"}
        emps2 = client.get(f"{API}/employees", headers=h2, timeout=30).json()
        assert not any(e["name"] == "TEST_Aria" for e in emps2)
        tasks2 = client.get(f"{API}/tasks", headers=h2, timeout=30).json()
        assert tasks2 == []
        # cross-tenant read of other company's employee must 404
        r = client.get(f"{API}/employees/{ai_agent['id']}", headers=h2, timeout=30)
        assert r.status_code == 404
        appr2 = client.get(f"{API}/approvals", headers=h2, timeout=30).json()
        assert appr2 == []
