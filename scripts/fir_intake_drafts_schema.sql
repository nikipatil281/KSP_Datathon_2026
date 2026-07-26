CREATE TABLE IF NOT EXISTS FIRIntakeDrafts (
    FIRNumber VARCHAR(80),
    SourceFile VARCHAR(255),
    OCRProvider VARCHAR(80),
    OCRConfidence VARCHAR(40),
    District VARCHAR(120),
    PoliceStation VARCHAR(160),
    CrimeType VARCHAR(160),
    IncidentDate VARCHAR(40),
    LegalSections VARCHAR(500),
    ReviewStatus VARCHAR(80),
    ExtractedJson TEXT,
    TablePayloadJson TEXT,
    AssistantNotes TEXT
);
