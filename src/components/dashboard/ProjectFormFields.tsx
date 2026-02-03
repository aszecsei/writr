"use client";

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

const inputClassName =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

export function ProjectFormFields({
  values,
  onChange,
}: ProjectFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
          <input
            type="text"
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            className={inputClassName}
            placeholder="My Novel"
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Genre
          <input
            type="text"
            value={values.genre}
            onChange={(e) => onChange({ ...values, genre: e.target.value })}
            className={inputClassName}
            placeholder="Fantasy, Sci-Fi, etc."
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
          <textarea
            value={values.description}
            onChange={(e) =>
              onChange({ ...values, description: e.target.value })
            }
            rows={3}
            className={inputClassName}
            placeholder="A brief description of your project..."
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
            className={inputClassName}
            placeholder="0"
          />
        </label>
      </div>
    </>
  );
}
