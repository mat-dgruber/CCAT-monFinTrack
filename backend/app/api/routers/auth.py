import os

from app.core.logger import get_logger
from app.schemas.auth import EmailVerificationRequest, PasswordResetRequest
from app.services.email_service import email_service
from fastapi import APIRouter, BackgroundTasks, HTTPException
from firebase_admin import auth

logger = get_logger(__name__)
router = APIRouter()

APP_URL = os.getenv("APP_URL", "https://monfintrack.com.br").rstrip('/')
LOGO_URL = "https://monfintrack.com.br/assets/logo-ccat.png"


@router.post("/reset-password")
async def request_password_reset(
    request: PasswordResetRequest, background_tasks: BackgroundTasks
):
    try:
        # Get user to get display name (if exists)
        try:
            user = auth.get_user_by_email(request.email)
            name = user.display_name or "Usuário"
        except auth.UserNotFoundError:
            # Don't reveal if user exists for security, but log it
            logger.info(
                f"Password reset requested for non-existent email: {request.email}"
            )
            return {
                "status": "success",
                "message": "Se o e-mail estiver cadastrado, você receberá um link",
            }

        # Generate Firebase Reset Link
        action_code_settings = auth.ActionCodeSettings(
            url=f"{APP_URL}/login",
            handle_code_in_app=True,
        )

        firebase_link = auth.generate_password_reset_link(request.email, action_code_settings)

        # Extract oobCode for a direct link to our themed reset page
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(firebase_link)
        params = parse_qs(parsed_url.query)
        oob_code = params.get('oobCode', [None])[0]

        if oob_code:
            link = f"{APP_URL}/reset-password/?oobCode={oob_code}"
            logger.info(f"Direct password reset link generated for {request.email}")
        else:
            link = firebase_link
            logger.warning(f"Failed to parse oobCode for password reset link ({request.email})")

        # Render and Send Email
        html_content = email_service.render_template(
            "auth_reset_password.html",
            {
                "logo_url": LOGO_URL,
                "name": name,
                "email": request.email,
                "action_url": link,
                "app_name": "MonFinTrack",
            },
        )

        background_tasks.add_task(
            email_service.send_email,
            subject="Redefinir sua senha - MonFinTrack",
            recipients=[request.email],
            body=html_content,
        )

        return {"status": "success", "message": "E-mail de redefinição enviado"}
    except auth.UserNotFoundError:
        # Don't reveal if user exists for security, but log it
        logger.info(f"Password reset requested for non-existent email: {request.email}")
        return {
            "status": "success",
            "message": "Se o e-mail estiver cadastrado, você receberá um link",
        }
    except Exception as e:
        logger.error(f"Error in request_password_reset: {e}")
        raise HTTPException(
            status_code=500, detail="Erro ao enviar e-mail de redefinição"
        ) from e


@router.post("/verify-email")
async def request_email_verification(
    request: EmailVerificationRequest, background_tasks: BackgroundTasks
):
    try:
        # Get user to get display name
        try:
            user = auth.get_user_by_email(request.email)
        except auth.UserNotFoundError as err:
            logger.warning(
                f"Verification email requested for non-existent user: {request.email}"
            )
            raise HTTPException(status_code=404, detail="Usuário não encontrado") from err

        # Generate Firebase Verification Link
        try:
            action_code_settings = auth.ActionCodeSettings(
                url=f"{APP_URL}/verify-email/",
                handle_code_in_app=True,
            )
            # This generates a long Firebase handler URL
            firebase_link = auth.generate_email_verification_link(
                request.email, action_code_settings
            )
            # Extract oobCode and use a DIRECT link to our app to bypass Firebase UI
            # and prevent parameter stripping during redirects.
            from urllib.parse import urlparse, parse_qs
            parsed_url = urlparse(firebase_link)
            params = parse_qs(parsed_url.query)
            oob_code = params.get('oobCode', [None])[0]
            if oob_code:
                # Direct link to our themed verification page
                link = f"{APP_URL}/verify-email/?oobCode={oob_code}"
                logger.info(f"Direct verification link generated for {request.email}")
            else:
                # Fallback to the original link if parsing fails for some reason
                link = firebase_link
                logger.warning(f"Failed to parse oobCode from link for {request.email}, using Firebase default link.")

        except Exception as e:
            logger.error(f"Error generating verification link for {request.email}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Erro ao gerar link de verificação: {str(e)}"
            ) from e

        # Render and Send Email
        try:
            html_content = email_service.render_template(
                "auth_verify_email.html",
                {
                    "logo_url": LOGO_URL,
                    "name": user.display_name or "Usuário",
                    "action_url": link,
                    "app_name": "MonFinTrack",
                },
            )
        except Exception as e:
            logger.error(f"Error rendering email template: {e}")
            raise HTTPException(
                status_code=500, detail="Erro ao renderizar e-mail de verificação"
            ) from e

        background_tasks.add_task(
            email_service.send_email,
            subject="Verifique seu e-mail - MonFinTrack",
            recipients=[request.email],
            body=html_content,
        )

        return {"status": "success", "message": "E-mail de verificação enviado"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unexpected error in request_email_verification for {request.email}: {e}"
        )
        raise HTTPException(
            status_code=500, detail="Erro inesperado ao enviar e-mail de verificação"
        ) from e
