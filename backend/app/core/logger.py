"""
Módulo de logging centralizado do MonFinTrack.
Substitui todos os print() por logging estruturado.
"""

import logging
import sys


def get_logger(name: str = "monfintrack") -> logging.Logger:
    """
    Retorna um logger configurado para o módulo especificado.
    
    Usage:
        from app.core.logger import get_logger
        logger = get_logger(__name__)
        logger.info("Mensagem informativa")
        logger.warning("Aviso")
        logger.error("Erro: %s", err)
    """
    logger = logging.getLogger(name)

    # Evita duplicação de handlers se chamado múltiplas vezes
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)

        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

    return logger
