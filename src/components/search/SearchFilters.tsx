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
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Filter:</span>
      <button
        type="button"
        onClick={handleSelectAll}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          allSelected
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
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
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
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
