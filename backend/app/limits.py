"""Shared Phase 1 PDF and Lesson limits (LORELY_SPEC.md section 40)."""

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_PAGES = 80
MAX_EXTRACTED_CHARACTERS = 200000
# The specification leaves "insufficient" undefined. This minimum rejects
# blank/scanned documents and isolated labels without requiring OCR.
MIN_SELECTABLE_CHARACTERS = 100
