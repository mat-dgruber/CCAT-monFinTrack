import uuid
from typing import List

from app.core.database import db
from app.core.security import get_current_user
from app.schemas.seasonal_income import (
    SeasonalIncome,
    SeasonalIncomeCreate,
    SeasonalIncomeUpdate,
)
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/api/resources", tags=["Resources"])


@router.get("", response_model=List[SeasonalIncome])
def list_resources(current_user: dict = Depends(get_current_user)):
    """Listar todos os recursos sazonais do usuário"""
    user_id = current_user["uid"]
    resources_ref = db.collection("seasonal_incomes").where("user_id", "==", user_id)
    docs = resources_ref.stream()

    resources = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        resources.append(data)

    # Sort by date
    resources.sort(key=lambda x: x.get("receive_date", ""))
    return resources


@router.post("", response_model=SeasonalIncome, status_code=status.HTTP_201_CREATED)
def create_resource(
    resource: SeasonalIncomeCreate, current_user: dict = Depends(get_current_user)
):
    """Cadastrar novo recurso sazonal"""
    user_id = current_user["uid"]
    new_id = str(uuid.uuid4())
    data = resource.dict()
    data["user_id"] = user_id

    # Converting date to string for safer storage/retrieval consistency across other endpoints
    data["receive_date"] = data["receive_date"].isoformat()

    db.collection("seasonal_incomes").document(new_id).set(data)

    return {**data, "id": new_id}


@router.put("/{resource_id}", response_model=SeasonalIncome)
def update_resource(
    resource_id: str,
    update_data: SeasonalIncomeUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["uid"]
    doc_ref = db.collection("seasonal_incomes").document(resource_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Resource not found")

    existing_data = doc.to_dict()
    if existing_data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_dict = update_data.dict(exclude_unset=True)
    if "receive_date" in update_dict:
        update_dict["receive_date"] = update_dict["receive_date"].isoformat()

    doc_ref.update(update_dict)

    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = resource_id
    return updated_doc


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    doc_ref = db.collection("seasonal_incomes").document(resource_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Resource not found")

    if doc.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    doc_ref.delete()
    return None
