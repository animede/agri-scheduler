"""Task（作業）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = make_crud_router(
    model=Task,
    create_schema=TaskCreate,
    update_schema=TaskUpdate,
    response_schema=TaskResponse,
    prefix="/api/tasks",
    tag="tasks",
    not_found_detail="Task not found",
)
