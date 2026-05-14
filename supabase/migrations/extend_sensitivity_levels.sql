-- Extend buildings sensitivity_level constraint to include 'student' and 'admin'
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE public.buildings
DROP CONSTRAINT buildings_sensitivity_level_check;

-- Add new constraint with extended values
ALTER TABLE public.buildings
ADD CONSTRAINT buildings_sensitivity_level_check 
CHECK (sensitivity_level IN ('public', 'student', 'staff', 'admin'));
