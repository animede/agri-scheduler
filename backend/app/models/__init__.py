"""SQLAlchemyモデル一式。

`Base.metadata.create_all(engine)` がテーブルを検出できるよう、
このパッケージをimportした時点で全モデルがロードされるようにしておく。
"""

from app.models.bed import Bed
from app.models.bed_segment import BedSegment
from app.models.crop import Crop
from app.models.crop_family import CropFamily
from app.models.field import Field
from app.models.planting import Planting
from app.models.task import Task
from app.models.variety import Variety

__all__ = [
    "Bed",
    "BedSegment",
    "Crop",
    "CropFamily",
    "Field",
    "Planting",
    "Task",
    "Variety",
]
