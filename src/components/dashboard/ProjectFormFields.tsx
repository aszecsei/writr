"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";

export interface ProjectFormData {
  title: string;
  description: string;
  genre: string;
  targetWordCount: number;
}

interface ProjectFormFieldsProps {
  values: ProjectFormData;
  onChange: (values: ProjectFormData) => void;
}

export function ProjectFormFields({
  values,
  onChange,
}: ProjectFormFieldsProps) {
  return (
    <>
      <div>
        <label className={LABEL_CLASS}>
          Title
          <input
            type="text"
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            className={INPUT_CLASS}
            placeholder="My Novel"
          />
        </label>
      </div>
      <div>
        <label className={LABEL_CLASS}>
          Genre
          <input
            type="text"
            value={values.genre}
            onChange={(e) => onChange({ ...values, genre: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Fantasy, Sci-Fi, etc."
          />
        </label>
      </div>
      <div>
        <label className={LABEL_CLASS}>
          Description
          <textarea
            value={values.description}
            onChange={(e) =>
              onChange({ ...values, description: e.target.value })
            }
            rows={3}
            className={INPUT_CLASS}
            placeholder="A brief description of your project..."
          />
        </label>
      </div>
      <div>
        <label className={LABEL_CLASS}>
          Target Word Count
          <input
            type="number"
            value={values.targetWordCount}
            onChange={(e) =>
              onChange({
                ...values,
                targetWordCount: Number.parseInt(e.target.value, 10) || 0,
              })
            }
            min={0}
            className={INPUT_CLASS}
            placeholder="0"
          />
        </label>
      </div>
    </>
  );
}
