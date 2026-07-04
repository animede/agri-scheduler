"""汎用CRUDルーターファクトリ。

8リソース(CropFamily/Crop/Variety/Field/Bed/BedSegment/Planting/Task)は
一覧・詳細・作成・更新・削除という同じ形のエンドポイントを持つため、
共通実装をここにまとめ、各リソースファイルでは対象モデル・スキーマを
指定するだけで済むようにする。
"""

from typing import Any, TypeVar

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import Base, get_db

ModelT = TypeVar("ModelT", bound=Base)
CreateSchemaT = TypeVar("CreateSchemaT", bound=BaseModel)
UpdateSchemaT = TypeVar("UpdateSchemaT", bound=BaseModel)
ResponseSchemaT = TypeVar("ResponseSchemaT", bound=BaseModel)


def make_crud_router(
    *,
    model: type[ModelT],
    create_schema: type[CreateSchemaT],
    update_schema: type[UpdateSchemaT],
    response_schema: type[ResponseSchemaT],
    prefix: str,
    tag: str,
    not_found_detail: str,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    def _get_or_404(db: Session, item_id: int) -> ModelT:
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(status_code=404, detail=not_found_detail)
        return obj

    @router.get("", response_model=list[response_schema])  # type: ignore[valid-type]
    def list_items(db: Session = Depends(get_db)) -> list[Any]:
        return db.query(model).order_by(model.id).all()

    @router.get("/{item_id}", response_model=response_schema)  # type: ignore[valid-type]
    def get_item(item_id: int, db: Session = Depends(get_db)) -> Any:
        return _get_or_404(db, item_id)

    @router.post("", response_model=response_schema, status_code=201)  # type: ignore[valid-type]
    def create_item(payload: create_schema, db: Session = Depends(get_db)) -> Any:  # type: ignore[valid-type]
        obj = model(**payload.model_dump())
        db.add(obj)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=400, detail=f"入力値が不正です: {exc.orig}"
            ) from exc
        db.refresh(obj)
        return obj

    @router.put("/{item_id}", response_model=response_schema)  # type: ignore[valid-type]
    def update_item(
        item_id: int, payload: update_schema, db: Session = Depends(get_db)  # type: ignore[valid-type]
    ) -> Any:
        obj = _get_or_404(db, item_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(obj, key, value)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=400, detail=f"入力値が不正です: {exc.orig}"
            ) from exc
        db.refresh(obj)
        return obj

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: int, db: Session = Depends(get_db)) -> None:
        obj = _get_or_404(db, item_id)
        try:
            db.delete(obj)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="他のレコードから参照されているため削除できません",
            ) from exc
        return None

    return router
