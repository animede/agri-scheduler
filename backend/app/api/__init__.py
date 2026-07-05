"""APIルーター一式。"""

from app.api.ai_analysis import router as ai_analysis_router
from app.api.bed_segments import router as bed_segments_router
from app.api.beds import router as beds_router
from app.api.crop_families import router as crop_families_router
from app.api.crops import router as crops_router
from app.api.fields import router as fields_router
from app.api.plantings import router as plantings_router
from app.api.tasks import router as tasks_router
from app.api.varieties import router as varieties_router

all_routers = [
    crop_families_router,
    crops_router,
    varieties_router,
    fields_router,
    beds_router,
    bed_segments_router,
    plantings_router,
    tasks_router,
    ai_analysis_router,
]

__all__ = ["all_routers"]
