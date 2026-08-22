-- ====================================================================
-- UP MIGRATION
-- ====================================================================

-- Co-guardian sharing: a child is owned by the creating parent
-- (children.parent_id) and can be shared with additional guardian
-- accounts so a second parent/guardian does not need to share
-- credentials. Audit attribution stays per-person.
CREATE TABLE child_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'guardian' CHECK (role IN ('owner', 'guardian')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (child_id, parent_id)
);

CREATE INDEX idx_child_guardians_parent ON child_guardians(parent_id);

-- Seed the owner row for every existing child so ownership checks can
-- use this table uniformly.
INSERT INTO child_guardians (child_id, parent_id, role)
SELECT id, parent_id, 'owner' FROM children;

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS child_guardians;
*/
