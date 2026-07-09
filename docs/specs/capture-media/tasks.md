# Capture Media Tasks

## Task 1: Define Capture Intent UI

Add capture choices for manual entry, scan receipt, scan invoice, record meal, and attach photo.

Expected verification:

- User can choose each intent from Capture page.

## Task 2: Define Media Queue Model

Define local and cloud media queue states.

Expected verification:

- Local-only media can be represented without upload.

## Task 3: Define Temporary Scan Flow

Specify receipt/invoice scan draft creation and cleanup behavior.

Expected verification:

- Temporary scans never become permanent unless explicitly kept.

## Task 4: Define Meal Photo Flow

Specify meal creation with one or more photos.

Expected verification:

- One meal can link multiple photos.

## Task 5: Define Attachment Flow

Specify attachment target selection and media link intent.

Expected verification:

- Attachment cannot become permanent without target or explicit retain action.

## Task 6: Define Batch Capture Review

Specify grouping, split, merge, reorder, and relabel behavior.

Expected verification:

- AI/OCR grouping remains user-reviewable.

## Task 7: Define Failure And Manual Takeover

Specify OCR timeout, failure, manual takeover, and late-result behavior.

Expected verification:

- Late OCR results do not overwrite user-edited fields.

## Task 8: Add Capture Tests

Add tests for scan retention, meal multi-photo links, local-only state, and media byte exclusion.

Expected verification:

- Test plan cases are automated or mapped to smoke tests.
