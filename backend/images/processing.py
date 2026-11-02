import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image as PILImage
from PIL import ImageOps

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_SIDE = 2048


def normalize(upload) -> ContentFile:
    """Re-encode an uploaded picture as WebP, at most MAX_SIDE pixels on its longest side.

    Rotates it upright first, then drops all metadata: a phone photo's EXIF can
    contain where it was taken.
    """
    with PILImage.open(upload) as source:
        image = ImageOps.exif_transpose(source)
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
        buffer = BytesIO()
        image.save(buffer, format="WEBP", quality=85)
    return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.webp")
