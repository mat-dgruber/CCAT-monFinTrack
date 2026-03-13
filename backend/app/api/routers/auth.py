from fastapi import APIRouter, HTTPException, BackgroundTasks
from firebase_admin import auth
from app.schemas.auth import PasswordResetRequest, EmailVerificationRequest
from app.services.email_service import email_service
from app.core.logger import get_logger
import os

logger = get_logger(__name__)
router = APIRouter()

APP_URL = os.getenv("APP_URL", "https://ccat-monfintrack.web.app")
LOGO_URL = "https://monfintrack.com.br/assets/logo-ccat.png"

@router.post("/reset-password")
async def request_password_reset(request: PasswordResetRequest, background_tasks: BackgroundTasks):
    try:
        # Get user to get display name (if exists)
        try:
            user = auth.get_user_by_email(request.email)
            name = user.display_name or "Usuário"
        except auth.UserNotFoundError:
            # Don't reveal if user exists for security, but log it
            logger.info(f"Password reset requested for non-existent email: {request.email}")
            return {"status": "success", "message": "Se o e-mail estiver cadastrado, você receberá um link"}

        # Generate Firebase Reset Link
        action_code_settings = auth.ActionCodeSettings(
            url=f"{APP_URL}/login",
            handle_code_in_app=True,
        )
        
        link = auth.generate_password_reset_link(request.email, action_code_settings)
        
        # Render and Send Email
        html_content = email_service.render_template(
            "auth_reset_password.html",
            {
                "logo_url": LOGO_URL,
                "name": name,
                "email": request.email,
                "action_url": link,
                "app_name": "MonFinTrack"
            }
        )
        
        background_tasks.add_task(
            email_service.send_email,
            subject="Redefinir sua senha - MonFinTrack",
            recipients=[request.email],
            body=html_content
        )
        
        return {"status": "success", "message": "E-mail de redefinição enviado"}
    except auth.UserNotFoundError:
        # Don't reveal if user exists for security, but log it
        logger.info(f"Password reset requested for non-existent email: {request.email}")
        return {"status": "success", "message": "Se o e-mail estiver cadastrado, você receberá um link"}
    except Exception as e:
        logger.error(f"Error in request_password_reset: {e}")
        raise HTTPException(status_code=500, detail="Erro ao enviar e-mail de redefinição") from e

@router.post("/verify-email")
async def request_email_verification(request: EmailVerificationRequest, background_tasks: BackgroundTasks):
    try:
        # Get user to get display name
        try:
            user = auth.get_user_by_email(request.email)
        except auth.UserNotFoundError:
            logger.warning(f"Verification email requested for non-existent user: {request.email}")
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        # Generate Firebase Verification Link
        try:
            action_code_settings = auth.ActionCodeSettings(
                url=f"{APP_URL}/verify-email",
                handle_code_in_app=True,
            )
            link = auth.generate_email_verification_link(request.email, action_code_settings)
        except Exception as e:
            logger.error(f"Error generating verification link for {request.email}: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao gerar link de verificação: {str(e)}")

        # Render and Send Email
        try:
            html_content = email_service.render_template(
                "auth_verify_email.html",
                {
                    "logo_url": LOGO_URL,
                    "name": user.display_name or "Usuário",
                    "action_url": link,
                    "app_name": "MonFinTrack"
                }
            )
        except Exception as e:
            logger.error(f"Error rendering email template: {e}")
            raise HTTPException(status_code=500, detail="Erro ao renderizar e-mail de verificação")

        background_tasks.add_task(
            email_service.send_email,
            subject="Verifique seu e-mail - MonFinTrack",
            recipients=[request.email],
            body=html_content
        )
        
        return {"status": "success", "message": "E-mail de verificação enviado"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in request_email_verification for {request.email}: {e}")
        raise HTTPException(status_code=500, detail="Erro inesperado ao enviar e-mail de verificação") from e
