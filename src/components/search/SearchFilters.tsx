"use client";

import type { SearchableEntityType } from "@/lib/search";
import { entityConfigs, entityTypeOrder } from "@/lib/search";

interface SearchFiltersProps {
  selectedTypes: SearchableEntityType[];
  onTypesChange: (types: SearchableEntityType[]) => void;
}

export function SearchFilters({
  selectedTypes,
  onTypesChange,
}: SearchFiltersProps) {
  const allSelected = selectedTypes.length === 0;

  function handleToggleType(type: SearchableEntityType) {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  }

  function handleSelectAll() {
    onTypesChange([]);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        Filter:
      </span>
      <button
        type="button"
        onClick={handleSelectAll}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          allSelected
            ? "bg-primary-600 text-white dark:bg-primary-500 dark:text-white"
            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
        }`}
      >
        All
      </button>
      {entityTypeOrder.map((type) => {
        const config = entityConfigs[type];
        const Icon = config.icon;
        const isSelected = selectedTypes.includes(type);

        return (
          <button
            key={type}
            type="button"
            onClick={() => handleToggleType(type)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? "bg-primary-600 text-white dark:bg-primary-500 dark:text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            <Icon size={12} />
            {config.labelPlural}
          </button>
        );
      })}
    </div>
  );
}
