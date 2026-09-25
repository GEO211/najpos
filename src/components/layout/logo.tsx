"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const HALIYA_LOGO_SRC = "/haliayh.png";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
}

const sizes = {
  xs: { className: "h-11 w-11" },
  sm: { className: "h-16 w-16" },
  md: { className: "h-24 w-24" },
  lg: { className: "h-40 w-40" },
};

export function Logo({ size = "md", className, priority = false }: LogoProps) {
  const { className: sizeClass } = sizes[size];

  return (
    <Image
      src={HALIYA_LOGO_SRC}
      alt="HALIYA"
      height={1254}
      width={1254}
      sizes="160px"
      priority={priority}
      className={cn("block object-contain", sizeClass, className)}
    />
  );
}

