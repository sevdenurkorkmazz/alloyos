from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import time
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
DEFAULT_PROVIDER = os.environ.get('DEFAULT_AI_PROVIDER', 'gemini')
DEFAULT_MODEL = os.environ.get('DEFAULT_AI_MODEL', 'gemini-3-flash-preview')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("alloyos")

app = FastAPI(title="AlloyOS API")
api = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def clean(doc):
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return clean(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DepartmentIn(BaseModel):
    name: str
    color: Optional[str] = "#3B82F6"


class AgentIn(BaseModel):
    name: str
    role: str
    department_id: Optional[str] = None
    description: Optional[str] = ""
    personality: Optional[str] = ""
    skills: List[str] = []
    responsibilities: Optional[str] = ""
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    system_instructions: Optional[str] = ""
    avatar: Optional[dict] = None
    permissions: List[str] = ["execute_task", "message", "delegate"]


class HumanIn(BaseModel):
    name: str
    email: Optional[str] = None
    role: str
    department_id: Optional[str] = None
    avatar: Optional[dict] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[str] = None
    avatar: Optional[dict] = None
    status: Optional[str] = None
    system_instructions: Optional[str] = None
    personality: Optional[str] = None
    skills: Optional[List[str]] = None


class ProjectIn(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#00E599"


class TaskIn(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = None
    project_id: Optional[str] = None
    priority: Optional[str] = "medium"
    deadline: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    project_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class MessageIn(BaseModel):
    to_employee: str          # receiver employee id
    from_employee: str        # sender employee id
    body: str
    kind: Optional[str] = "message"   # message | task | report | approval


class ApprovalDecision(BaseModel):
    decision: Literal["approve", "reject", "edit"]
    edited_output: Optional[str] = None


# ---------------------------------------------------------------------------
# Office layout
# ---------------------------------------------------------------------------
def desk_position(index: int):
    """Deterministic desk position on a grid (x,z)."""
    cols = 4
    row = index // cols
    col = index % cols
    x = (col - (cols - 1) / 2) * 3.2
    z = row * 3.0 - 4.0
    return {"x": round(x, 2), "z": round(z, 2)}


async def next_desk_index(company_id: str) -> int:
    count = await db.employees.count_documents({"company_id": company_id})
    return count


# ---------------------------------------------------------------------------
# Events / activity
# ---------------------------------------------------------------------------
async def log_event(company_id: str, etype: str, payload: dict):
    ev = {
        "id": new_id(),
        "company_id": company_id,
        "type": etype,
        "payload": payload,
        "ts": time.time(),
        "created_at": now_iso(),
    }
    await db.events.insert_one(ev)


async def log_activity(company_id: str, text: str, actor_id: str = None, kind: str = "info"):
    act = {
        "id": new_id(),
        "company_id": company_id,
        "text": text,
        "actor_id": actor_id,
        "kind": kind,
        "created_at": now_iso(),
        "ts": time.time(),
    }
    await db.activity.insert_one(act)
    await log_event(company_id, "activity", {"text": text, "kind": kind})


async def set_employee_status(company_id: str, emp_id: str, status: str, activity_text: str = None):
    await db.employees.update_one(
        {"id": emp_id, "company_id": company_id},
        {"$set": {"status": status, "current_activity": activity_text or ""}},
    )
    await log_event(company_id, "status", {"employee_id": emp_id, "status": status, "activity": activity_text or ""})


async def create_envelope(company_id: str, from_emp: str, to_emp: str, kind: str):
    await log_event(company_id, "envelope", {"from": from_emp, "to": to_emp, "kind": kind})


# ---------------------------------------------------------------------------
# AI engine
# ---------------------------------------------------------------------------
AGENT_TEMPLATES = [
    {"key": "marketing", "name": "Marketing Agent", "role": "Marketing Specialist",
     "skills": ["Social media", "Content", "Competitor analysis"],
     "personality": "Energetic, creative, data-informed.",
     "responsibilities": "Social media research, content ideas, competitor analysis, marketing reports.",
     "system_instructions": "You are a senior marketing specialist. Produce concise, actionable marketing deliverables.",
     "accent": "#FF6B35"},
    {"key": "research", "name": "Research Agent", "role": "Research Analyst",
     "skills": ["Web research", "Data collection", "Reporting"],
     "personality": "Rigorous, analytical, thorough.",
     "responsibilities": "Web research, data gathering, structured reporting.",
     "system_instructions": "You are a research analyst. Gather insights and present clear, sourced, structured findings.",
     "accent": "#3B82F6"},
    {"key": "developer", "name": "Developer Agent", "role": "Software Developer",
     "skills": ["Coding", "Code review", "Debugging"],
     "personality": "Precise, pragmatic, detail-oriented.",
     "responsibilities": "Code generation, code analysis, technical research, bug fixing.",
     "system_instructions": "You are a senior software developer. Produce correct, clean code and clear technical explanations.",
     "accent": "#00E599"},
    {"key": "content", "name": "Content Agent", "role": "Content Writer",
     "skills": ["Blog", "Social copy", "Editing"],
     "personality": "Articulate, engaging, adaptable in tone.",
     "responsibilities": "Blog posts, social media, copywriting.",
     "system_instructions": "You are a professional content writer. Produce engaging, well-structured written content.",
     "accent": "#8B5CF6"},
    {"key": "designer", "name": "Designer Agent", "role": "Creative Designer",
     "skills": ["Visual concept", "Design ideas", "Branding"],
     "personality": "Imaginative, aesthetic-driven, bold.",
     "responsibilities": "Visual concepts, design directions, creative work.",
     "system_instructions": "You are a creative designer. Describe strong visual concepts and design directions clearly.",
     "accent": "#F59E0B"},
    {"key": "sales", "name": "Sales Agent", "role": "Sales Representative",
     "skills": ["Outreach", "Lead qualification", "Proposals"],
     "personality": "Persuasive, personable, goal-driven.",
     "responsibilities": "Outreach drafts, lead qualification, proposals.",
     "system_instructions": "You are a sales representative. Produce persuasive, concise sales assets.",
     "accent": "#10B981"},
]


async def run_agent_task(company_id: str, task_id: str):
    """Background execution of an AI agent working on a task."""
    task = clean(await db.tasks.find_one({"id": task_id, "company_id": company_id}))
    if not task or not task.get("assigned_to"):
        return
    agent = clean(await db.employees.find_one({"id": task["assigned_to"], "company_id": company_id}))
    if not agent or agent.get("type") != "ai":
        return

    try:
        # 1. walk + sit + work
        await set_employee_status(company_id, agent["id"], "working",
                                  f"Working on: {task['title']}")
        await db.tasks.update_one({"id": task_id}, {"$set": {"status": "working", "updated_at": now_iso()}})
        await log_activity(company_id, f"{agent['name']} started working on \"{task['title']}\".", agent["id"], "working")
        await asyncio.sleep(1.5)

        # 2. call LLM
        system = agent.get("system_instructions") or f"You are {agent['name']}, a {agent['role']}."
        persona = f"\nPersonality: {agent.get('personality','')}\nSkills: {', '.join(agent.get('skills', []))}"
        prompt = (f"Task: {task['title']}\n\nDetails: {task.get('description','')}\n\n"
                  f"Deliver a clear, well-structured result for this task. Keep it focused and professional.")
        provider = agent.get("ai_provider") or DEFAULT_PROVIDER
        model = agent.get("ai_model") or DEFAULT_MODEL
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"agent-{agent['id']}-task-{task_id}",
            system_message=system + persona,
        ).with_model(provider, model)
        try:
            output = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.exception("LLM error")
            output = f"[AI execution error] {str(e)}"

        # 3. save output, move task to review, create approval
        await db.tasks.update_one(
            {"id": task_id},
            {"$set": {"status": "review", "output": output, "updated_at": now_iso()}},
        )
        approval = {
            "id": new_id(),
            "company_id": company_id,
            "task_id": task_id,
            "agent_id": agent["id"],
            "title": task["title"],
            "output": output,
            "status": "pending",
            "created_at": now_iso(),
        }
        await db.approvals.insert_one(approval)

        # 4. message/envelope back to task creator
        creator_emp = task.get("created_by_employee")
        if creator_emp and creator_emp != agent["id"]:
            await deliver_message(company_id, agent["id"], creator_emp,
                                  f"Completed \"{task['title']}\". Ready for your review.", kind="report")

        await set_employee_status(company_id, agent["id"], "waiting", "Awaiting review")
        await log_activity(company_id, f"{agent['name']} finished \"{task['title']}\" — awaiting approval.", agent["id"], "review")
    except Exception:
        logger.exception("run_agent_task failed")
        await set_employee_status(company_id, agent["id"], "error", "Execution error")
        await db.tasks.update_one({"id": task_id}, {"$set": {"status": "assigned"}})


async def deliver_message(company_id: str, from_emp: str, to_emp: str, body: str, kind: str = "message"):
    """Create a message + conversation + notification + envelope event + activity."""
    conv_key = "::".join(sorted([from_emp, to_emp]))
    msg = {
        "id": new_id(),
        "company_id": company_id,
        "conversation": conv_key,
        "from_employee": from_emp,
        "to_employee": to_emp,
        "body": body,
        "kind": kind,
        "read": False,
        "created_at": now_iso(),
        "ts": time.time(),
    }
    await db.messages.insert_one(msg)
    sender = clean(await db.employees.find_one({"id": from_emp, "company_id": company_id})) or {}
    receiver = clean(await db.employees.find_one({"id": to_emp, "company_id": company_id})) or {}
    await db.notifications.insert_one({
        "id": new_id(), "company_id": company_id, "employee_id": to_emp,
        "text": f"{sender.get('name','Someone')}: {body[:80]}", "read": False,
        "created_at": now_iso(),
    })
    await create_envelope(company_id, from_emp, to_emp, kind)
    await log_activity(company_id,
                       f"{sender.get('name','?')} sent a {kind} to {receiver.get('name','?')}.",
                       from_emp, "message")
    return clean(msg)


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
DEFAULT_DEPARTMENTS = [
    ("Management", "#FF6B35"), ("Engineering", "#00E599"), ("Marketing", "#F59E0B"),
    ("Research", "#3B82F6"), ("Design", "#8B5CF6"), ("Sales", "#10B981"),
]


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    company_id = new_id()
    user_id = new_id()
    company = {"id": company_id, "name": body.company_name, "owner_id": user_id,
               "created_at": now_iso()}
    await db.companies.insert_one(company)
    user = {"id": user_id, "name": body.name, "email": email,
            "password_hash": hash_password(body.password), "company_id": company_id,
            "role": "owner", "created_at": now_iso()}
    await db.users.insert_one(user)

    dept_ids = {}
    for i, (dname, color) in enumerate(DEFAULT_DEPARTMENTS):
        did = new_id()
        dept_ids[dname] = did
        await db.departments.insert_one({"id": did, "company_id": company_id,
                                         "name": dname, "color": color, "created_at": now_iso()})

    # owner employee (human)
    idx = 0
    await db.employees.insert_one({
        "id": new_id(), "company_id": company_id, "type": "human", "user_id": user_id,
        "name": body.name, "role": "CEO", "department_id": dept_ids["Management"],
        "status": "idle", "current_activity": "",
        "avatar": {"skinTone": "#e8b58f", "hairColor": "#2b2b2b", "hairStyle": "short",
                   "facialHair": "clean", "shirtColor": "#FF6B35", "accessory": "none"},
        "desk_index": idx, "desk": desk_position(idx),
        "stats": {"completed": 0, "active": 0}, "created_at": now_iso(),
    })

    token = create_token(user_id, email)
    return {"token": token, "user": {"id": user_id, "name": body.name, "email": email,
            "company_id": company_id, "role": "owner"}, "company": clean(company)}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], email)
    company = clean(await db.companies.find_one({"id": user["company_id"]}))
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": email,
            "company_id": user["company_id"], "role": user.get("role", "owner")},
            "company": company}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    company = clean(await db.companies.find_one({"id": user["company_id"]}))
    return {"user": {"id": user["id"], "name": user["name"], "email": user["email"],
            "company_id": user["company_id"], "role": user.get("role", "owner")},
            "company": company}


# ---------------------------------------------------------------------------
# Company scoped dependency
# ---------------------------------------------------------------------------
async def company_ctx(user: dict = Depends(get_current_user)):
    return user["company_id"], user


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------
@api.get("/departments")
async def list_departments(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.departments.find({"company_id": cid}).to_list(200)
    return [clean(x) for x in items]


@api.post("/departments")
async def create_department(body: DepartmentIn, ctx=Depends(company_ctx)):
    cid, _ = ctx
    doc = {"id": new_id(), "company_id": cid, "name": body.name, "color": body.color,
           "created_at": now_iso()}
    await db.departments.insert_one(doc)
    return clean(doc)


# ---------------------------------------------------------------------------
# Employees (AI + human)
# ---------------------------------------------------------------------------
@api.get("/agent-templates")
async def agent_templates():
    return AGENT_TEMPLATES


@api.get("/employees")
async def list_employees(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.employees.find({"company_id": cid}).to_list(500)
    return [clean(x) for x in items]


@api.get("/employees/{emp_id}")
async def get_employee(emp_id: str, ctx=Depends(company_ctx)):
    cid, _ = ctx
    emp = await db.employees.find_one({"id": emp_id, "company_id": cid})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp = clean(emp)
    tasks = await db.tasks.find({"company_id": cid, "assigned_to": emp_id}).to_list(500)
    tasks = [clean(t) for t in tasks]
    emp["task_summary"] = {
        "completed": len([t for t in tasks if t["status"] == "completed"]),
        "active": len([t for t in tasks if t["status"] in ("working", "assigned")]),
        "waiting": len([t for t in tasks if t["status"] == "review"]),
    }
    msgs = await db.messages.count_documents({"company_id": cid,
                                              "$or": [{"from_employee": emp_id}, {"to_employee": emp_id}]})
    emp["message_count"] = msgs
    return emp


@api.post("/employees/ai")
async def create_agent(body: AgentIn, ctx=Depends(company_ctx)):
    cid, _ = ctx
    idx = await next_desk_index(cid)
    avatar = body.avatar or {"bodyColor": "#00E599", "visorColor": "#0b3d2e",
                             "accent": "#00E599", "antenna": True}
    doc = {
        "id": new_id(), "company_id": cid, "type": "ai", "name": body.name, "role": body.role,
        "department_id": body.department_id, "description": body.description,
        "personality": body.personality, "skills": body.skills,
        "responsibilities": body.responsibilities,
        "ai_provider": body.ai_provider or DEFAULT_PROVIDER,
        "ai_model": body.ai_model or DEFAULT_MODEL,
        "system_instructions": body.system_instructions,
        "permissions": body.permissions, "avatar": avatar,
        "status": "idle", "current_activity": "",
        "desk_index": idx, "desk": desk_position(idx),
        "stats": {"completed": 0, "active": 0}, "created_at": now_iso(),
    }
    await db.employees.insert_one(doc)
    await log_activity(cid, f"AI agent {body.name} ({body.role}) joined the company.", doc["id"], "hire")
    return clean(doc)


@api.post("/employees/human")
async def create_human(body: HumanIn, ctx=Depends(company_ctx)):
    cid, _ = ctx
    idx = await next_desk_index(cid)
    avatar = body.avatar or {"skinTone": "#e8b58f", "hairColor": "#2b2b2b", "hairStyle": "short",
                             "facialHair": "clean", "shirtColor": "#3B82F6", "accessory": "none"}
    doc = {
        "id": new_id(), "company_id": cid, "type": "human", "name": body.name,
        "email": (body.email or "").lower(), "role": body.role,
        "department_id": body.department_id, "avatar": avatar,
        "status": "idle", "current_activity": "", "invited": True,
        "desk_index": idx, "desk": desk_position(idx),
        "stats": {"completed": 0, "active": 0}, "created_at": now_iso(),
    }
    await db.employees.insert_one(doc)
    await log_activity(cid, f"{body.name} ({body.role}) was invited to the company.", doc["id"], "hire")
    return clean(doc)


@api.put("/employees/{emp_id}")
async def update_employee(emp_id: str, body: EmployeeUpdate, ctx=Depends(company_ctx)):
    cid, _ = ctx
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates")
    existing = await db.employees.find_one({"id": emp_id, "company_id": cid})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.employees.update_one({"id": emp_id, "company_id": cid}, {"$set": updates})
    emp = clean(await db.employees.find_one({"id": emp_id, "company_id": cid}))
    await log_event(cid, "employee_update", {"employee_id": emp_id})
    return emp


@api.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, ctx=Depends(company_ctx)):
    cid, _ = ctx
    res = await db.employees.delete_one({"id": emp_id, "company_id": cid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
@api.get("/projects")
async def list_projects(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.projects.find({"company_id": cid}).to_list(200)
    out = []
    for p in items:
        p = clean(p)
        p["task_count"] = await db.tasks.count_documents({"company_id": cid, "project_id": p["id"]})
        out.append(p)
    return out


@api.post("/projects")
async def create_project(body: ProjectIn, ctx=Depends(company_ctx)):
    cid, _ = ctx
    doc = {"id": new_id(), "company_id": cid, "name": body.name, "description": body.description,
           "color": body.color, "status": "active", "created_at": now_iso()}
    await db.projects.insert_one(doc)
    await log_activity(cid, f"Project \"{body.name}\" was created.", None, "project")
    return clean(doc)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------
async def _actor_employee(cid, user):
    emp = await db.employees.find_one({"company_id": cid, "user_id": user["id"]})
    return emp["id"] if emp else None


async def _maybe_run(cid, task_id, assigned_to):
    if not assigned_to:
        return
    emp = await db.employees.find_one({"id": assigned_to, "company_id": cid})
    if emp and emp.get("type") == "ai":
        asyncio.create_task(run_agent_task(cid, task_id))


@api.get("/tasks")
async def list_tasks(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.tasks.find({"company_id": cid}).sort("ts", -1).to_list(500)
    return [clean(x) for x in items]


@api.post("/tasks")
async def create_task(body: TaskIn, ctx=Depends(company_ctx)):
    cid, user = ctx
    actor = await _actor_employee(cid, user)
    status = "assigned" if body.assigned_to else "backlog"
    doc = {
        "id": new_id(), "company_id": cid, "title": body.title, "description": body.description,
        "assigned_to": body.assigned_to, "project_id": body.project_id,
        "priority": body.priority, "status": status, "deadline": body.deadline,
        "created_by": user["id"], "created_by_employee": actor, "output": None,
        "created_at": now_iso(), "updated_at": now_iso(), "ts": time.time(),
    }
    await db.tasks.insert_one(doc)
    assignee = clean(await db.employees.find_one({"id": body.assigned_to})) if body.assigned_to else None
    await log_activity(cid, f"Task \"{body.title}\" created"
                       + (f" and assigned to {assignee['name']}." if assignee else "."),
                       actor, "task")
    if body.assigned_to and actor and actor != body.assigned_to:
        await deliver_message(cid, actor, body.assigned_to, f"New task: {body.title}", kind="task")
    await _maybe_run(cid, doc["id"], body.assigned_to)
    return clean(doc)


@api.put("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, ctx=Depends(company_ctx)):
    cid, _ = ctx
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    prev = clean(await db.tasks.find_one({"id": task_id, "company_id": cid}))
    if not prev:
        raise HTTPException(status_code=404, detail="Task not found")
    if "assigned_to" in updates and updates["assigned_to"] and prev.get("status") == "backlog":
        updates.setdefault("status", "assigned")
    await db.tasks.update_one({"id": task_id, "company_id": cid}, {"$set": updates})
    task = clean(await db.tasks.find_one({"id": task_id, "company_id": cid}))
    await log_event(cid, "task_update", {"task_id": task_id, "status": task["status"]})
    # newly assigned to an AI -> run
    if updates.get("assigned_to") and updates["assigned_to"] != prev.get("assigned_to"):
        await _maybe_run(cid, task_id, updates["assigned_to"])
    return task


@api.post("/tasks/{task_id}/run")
async def run_task(task_id: str, ctx=Depends(company_ctx)):
    cid, _ = ctx
    task = clean(await db.tasks.find_one({"id": task_id, "company_id": cid}))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.get("assigned_to"):
        raise HTTPException(status_code=400, detail="Assign the task to an AI agent first")
    asyncio.create_task(run_agent_task(cid, task_id))
    return {"ok": True, "status": "running"}


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, ctx=Depends(company_ctx)):
    cid, _ = ctx
    await db.tasks.delete_one({"id": task_id, "company_id": cid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
@api.get("/messages")
async def list_messages(with_employee: Optional[str] = None, employee: Optional[str] = None,
                        ctx=Depends(company_ctx)):
    cid, _ = ctx
    q = {"company_id": cid}
    if with_employee and employee:
        conv_key = "::".join(sorted([with_employee, employee]))
        q["conversation"] = conv_key
    items = await db.messages.find(q).sort("ts", 1).to_list(1000)
    return [clean(x) for x in items]


@api.post("/messages")
async def post_message(body: MessageIn, ctx=Depends(company_ctx)):
    cid, _ = ctx
    for eid in (body.from_employee, body.to_employee):
        if not await db.employees.find_one({"id": eid, "company_id": cid}):
            raise HTTPException(status_code=404, detail="Employee not in company")
    msg = await deliver_message(cid, body.from_employee, body.to_employee, body.body, body.kind)
    return msg


@api.get("/conversations")
async def conversations(employee: str, ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.messages.find({"company_id": cid,
                                    "$or": [{"from_employee": employee}, {"to_employee": employee}]}
                                   ).sort("ts", -1).to_list(1000)
    seen = {}
    for m in items:
        m = clean(m)
        other = m["to_employee"] if m["from_employee"] == employee else m["from_employee"]
        if other not in seen:
            seen[other] = {"employee_id": other, "last": m["body"], "ts": m["ts"],
                           "unread": 0}
        if not m["read"] and m["to_employee"] == employee:
            seen[other]["unread"] += 1
    return list(seen.values())


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@api.get("/notifications")
async def list_notifications(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.notifications.find({"company_id": cid}).sort("created_at", -1).to_list(100)
    return [clean(x) for x in items]


# ---------------------------------------------------------------------------
# Approvals (human-in-the-loop)
# ---------------------------------------------------------------------------
@api.get("/approvals")
async def list_approvals(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.approvals.find({"company_id": cid}).sort("created_at", -1).to_list(200)
    out = []
    for a in items:
        a = clean(a)
        agent = clean(await db.employees.find_one({"id": a["agent_id"]})) or {}
        a["agent_name"] = agent.get("name", "Agent")
        out.append(a)
    return out


@api.post("/approvals/{approval_id}/decision")
async def decide_approval(approval_id: str, body: ApprovalDecision, ctx=Depends(company_ctx)):
    cid, _ = ctx
    appr = clean(await db.approvals.find_one({"id": approval_id, "company_id": cid}))
    if not appr:
        raise HTTPException(status_code=404, detail="Approval not found")
    if appr.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Approval already decided")
    agent = clean(await db.employees.find_one({"id": appr["agent_id"]})) or {}
    if body.decision == "approve" or body.decision == "edit":
        output = body.edited_output if body.decision == "edit" else appr["output"]
        await db.tasks.update_one({"id": appr["task_id"]},
                                  {"$set": {"status": "completed", "output": output,
                                            "updated_at": now_iso()}})
        await db.approvals.update_one({"id": approval_id}, {"$set": {"status": body.decision, "output": output}})
        await db.employees.update_one({"id": appr["agent_id"]},
                                      {"$inc": {"stats.completed": 1},
                                       "$set": {"status": "idle", "current_activity": ""}})
        await set_employee_status(cid, appr["agent_id"], "idle")
        await log_activity(cid, f"{agent.get('name','Agent')}'s task \"{appr['title']}\" was {body.decision}d.",
                           appr["agent_id"], "completed")
    else:  # reject
        await db.tasks.update_one({"id": appr["task_id"]},
                                  {"$set": {"status": "assigned", "updated_at": now_iso()}})
        await db.approvals.update_one({"id": approval_id}, {"$set": {"status": "rejected"}})
        await set_employee_status(cid, appr["agent_id"], "idle")
        await log_activity(cid, f"{agent.get('name','Agent')}'s output for \"{appr['title']}\" was rejected.",
                           appr["agent_id"], "error")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Activity + events + dashboard
# ---------------------------------------------------------------------------
@api.get("/activity")
async def get_activity(ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.activity.find({"company_id": cid}).sort("ts", -1).to_list(100)
    return [clean(x) for x in items]


@api.get("/events")
async def get_events(since: float = 0.0, ctx=Depends(company_ctx)):
    cid, _ = ctx
    items = await db.events.find({"company_id": cid, "ts": {"$gt": since}}).sort("ts", 1).to_list(200)
    items = [clean(x) for x in items]
    now = time.time()
    return {"events": items, "now": now}


@api.get("/dashboard/stats")
async def dashboard_stats(ctx=Depends(company_ctx)):
    cid, _ = ctx
    emps = [clean(x) for x in await db.employees.find({"company_id": cid}).to_list(500)]
    tasks = [clean(x) for x in await db.tasks.find({"company_id": cid}).to_list(1000)]
    projects = await db.projects.count_documents({"company_id": cid})
    ai = [e for e in emps if e["type"] == "ai"]
    human = [e for e in emps if e["type"] == "human"]
    return {
        "employees": {"total": len(emps), "human": len(human), "ai": len(ai)},
        "tasks": {
            "total": len(tasks),
            "completed": len([t for t in tasks if t["status"] == "completed"]),
            "working": len([t for t in tasks if t["status"] == "working"]),
            "review": len([t for t in tasks if t["status"] == "review"]),
            "backlog": len([t for t in tasks if t["status"] == "backlog"]),
            "assigned": len([t for t in tasks if t["status"] == "assigned"]),
        },
        "projects": {"active": projects},
        "agents": {
            "active": len([a for a in ai if a["status"] in ("working",)]),
            "waiting": len([a for a in ai if a["status"] == "waiting"]),
            "idle": len([a for a in ai if a["status"] == "idle"]),
            "total": len(ai),
        },
    }


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.employees.create_index("company_id")
    await db.events.create_index([("company_id", 1), ("ts", 1)])


@app.on_event("shutdown")
async def shutdown():
    client.close()
