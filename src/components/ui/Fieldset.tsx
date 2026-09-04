import type { ReactNode } from "react";
import { LEGEND_CLASS } from "./form-styles";

interface FieldsetProps {
  legend: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Fieldset({ legend, className, children }: FieldsetProps) {
  return (
    <fieldset className={className}>
      <legend className={LEGEND_CLASS}>{legend}</legend>
      {children}
    </fieldset>
  );
}
