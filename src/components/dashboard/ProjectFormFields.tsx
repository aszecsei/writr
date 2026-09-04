"use client";

import { Fieldset } from "@/components/ui/Fieldset";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import type { ProjectMode } from "@/db/schemas";
import { ProjectCoverField } from "./ProjectCoverField";

export interface ProjectFormData {
  title: string;
  description: string;
  genre: string;
  targetWordCount: number;
  mode: ProjectMode;
  coverImageUrl: string;
}

export const DEFAULT_PROJECT_FORM_VALUES: ProjectFormData = {
  title: "",
  description: "",
  genre: "",
  targetWordCount: 0,
  mode: "prose",
  coverImageUrl: "",
};

interface ProjectFormFieldsProps {
  values: ProjectFormData;
  onChange: (values: ProjectFormData) => void;
  /** Hide the mode selector (e.g. when editing an existing project). */
  hideMode?: boolean;
}

const MODE_OPTIONS: { value: ProjectMode; label: string; desc: string }[] = [
  { value: "prose", label: "Prose", desc: "Novel, short story, etc." },
  {
    value: "screenplay",
    label: "Screenplay",
    desc: "Fountain-formatted script",
  },
];

export function ProjectFormFields({
  values,
  onChange,
  hideMode,
}: ProjectFormFieldsProps) {
  const isScreenplay = values.mode === "screenplay";

  return (
    <>
      {!hideMode && (
        <Fieldset legend="Project Type">
          <div className="mt-2 flex gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...values, mode: opt.value })}
                className={`${RADIO_BASE} ${values.mode === opt.value ? RADIO_ACTIVE : RADIO_INACTIVE}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Fieldset>
      )}
      <ProjectCoverField
        value={values.coverImageUrl}
        onChange={(coverImageUrl) => onChange({ ...values, coverImageUrl })}
      />
      <div>
        <label className={LABEL_CLASS}>
          Title
          <input
            type="text"
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            className={INPUT_CLASS}
            placeholder={isScreenplay ? "My Screenplay" : "My Novel"}
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
            placeholder={
              isScreenplay
                ? "Drama, Thriller, Comedy, etc."
                : "Fantasy, Sci-Fi, etc."
            }
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
      {!isScreenplay && (
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
      )}
    </>
  );
}
