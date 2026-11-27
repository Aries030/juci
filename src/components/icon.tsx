import type * as React from "react";
import { ICONS, type IconName } from "@/components/icon-data";

export function Icon({
  name,
  ...props
}: { name: IconName } & Omit<React.SVGProps<SVGSVGElement>, "children">): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    />
  );
}
