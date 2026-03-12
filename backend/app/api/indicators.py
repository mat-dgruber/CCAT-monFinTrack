from fastapi import APIRouter, HTTPException, Query
import requests
from typing import List, Dict, Any

router = APIRouter(prefix="/api/indicators", tags=["Indicators"])

BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"

from datetime import datetime, timedelta

@router.get("/latest/{serie_id}")
def get_latest_indicator(serie_id: int):
    """
    Busca o último valor de uma série do SGS/BCB usando busca por período 
    (mais estável que o endpoint /ultimo).
    """
    try:
        # Busca os últimos 30 dias para garantir que pegamos o dado mais recente disponível
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        start_str = start_date.strftime("%d/%m/%Y")
        end_str = end_date.strftime("%d/%m/%Y")
        
        url = f"{BCB_BASE_URL}.{serie_id}/dados?formato=json&dataInicial={start_str}&dataFinal={end_str}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if not data:
            raise HTTPException(status_code=404, detail="Nenhum dado encontrado no período recente.")
            
        # Pega o último item da lista (mais recente)
        latest = data[-1]
            
        return {
            "data": latest["data"],
            "valor": float(latest["valor"]),
            "serie_id": serie_id
        }
    except Exception as e:
        # Log simplificado para o frontend
        detail = str(e)
        if "502" in detail:
            detail = "API do Banco Central temporariamente indisponível (502)."
        raise HTTPException(status_code=502, detail=f"Erro ao consultar BCB: {detail}")

@router.get("/period/{serie_id}")
def get_indicator_period(
    serie_id: int, 
    start_date: str = Query(..., description="DD/MM/YYYY"), 
    end_date: str = Query(..., description="DD/MM/YYYY")
):
    """
    Busca valores de uma série em um intervalo de datas.
    """
    try:
        url = f"{BCB_BASE_URL}.{serie_id}/dados?formato=json&dataInicial={start_date}&dataFinal={end_date}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar BCB: {str(e)}")
