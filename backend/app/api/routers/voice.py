"""Voice + anti-impersonation endpoints.

Two purposes:
1. Store a short voice sample of a found person ("description" kind). A family
   member can *play it back* to recognise a relative with more conviction than a
   text description — invaluable for the elderly who cannot give clear details.
2. Anti-impersonation ("secret_answer" kind). At intake the volunteer records a
   secret question whose answer only the genuine family/person knows. When
   someone claims the person, the claimant's answer is checked against the stored
   hash — blocking a would-be abductor from falsely claiming a child or elder.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.core.security import hash_pii
from app.db.base import get_db
from app.db.models import Case, VoiceSample
from app.schemas.models import VerifyRequest, VerifyResponse, VoiceOut
from app.services.case_service import audit
from app.voice import storage, stt, tts

router = APIRouter(tags=["voice"])


@router.post("/cases/{case_id}/voice", response_model=VoiceOut)
async def upload_voice(
    case_id: str,
    file: UploadFile = File(...),
    kind: str = Form(default="description"),
    language: str = Form(default=""),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    blob = await file.read()
    if not blob:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty audio")
    content_type = file.content_type or "audio/webm"
    ext = (content_type.split("/")[-1] or "webm").split(";")[0]
    sample = VoiceSample(case_id=case.id, kind=kind, content_type=content_type,
                         language=language or case.language)
    storage_key, url = storage.save(blob, f"{sample.id}.{ext}", content_type)
    sample.storage_key = storage_key
    sample.url = url
    # Best-effort transcription with AUTO-DETECT (spoken language is independent
    # of the UI / stored language hint).
    sample.transcript = stt.transcribe(blob, content_type, None)
    db.add(sample)
    audit(db, "voice.upload", actor=user.id, entity_type="case", entity_id=case.id, meta={"kind": kind})
    db.commit()
    db.refresh(sample)
    return VoiceOut.model_validate(sample)


class TtsRequest(BaseModel):
    text: str
    language: str = "Hindi"


@router.post("/tts")
def text_to_speech(payload: TtsRequest, user: CurrentUser = Depends(get_current_user)):
    """Synthesize real audio for any supported Indian language (browsers can't).
    Returns 204 when TTS is unavailable/unsupported so the client falls back to
    on-device speech synthesis."""
    result = tts.synthesize(payload.text, payload.language)
    if not result:
        return Response(status_code=204)
    audio, content_type = result
    return Response(content=audio, media_type=content_type)


@router.get("/voice/{sample_id}/audio")
def get_audio(sample_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    sample = db.get(VoiceSample, sample_id)
    if not sample:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sample not found")
    if sample.url:
        # Stored on object storage; redirect the client there.
        return Response(status_code=307, headers={"Location": sample.url})
    blob = storage.load(sample.storage_key)
    if blob is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audio missing")
    return Response(content=blob, media_type=sample.content_type)


@router.get("/cases/{case_id}/voice", response_model=list[VoiceOut])
def list_voice(case_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return [VoiceOut.model_validate(v) for v in case.voice_samples]


@router.post("/cases/{case_id}/verify", response_model=VerifyResponse)
def verify_secret(
    case_id: str,
    payload: VerifyRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if not case.secret_answer_hash:
        return VerifyResponse(verified=False, message="No secret question is set for this case.")
    ok = hash_pii(payload.answer.strip().lower()) == case.secret_answer_hash
    audit(db, "case.verify", actor=user.id, entity_type="case", entity_id=case.id,
          meta={"verified": ok})
    db.commit()
    msg = "Answer matches — identity confirmed." if ok else "Answer does not match. Do NOT release the person; escalate to police."
    return VerifyResponse(verified=ok, message=msg)
