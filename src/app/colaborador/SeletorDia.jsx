"use client";
import { useRouter } from "next/navigation";
import { entradaCls } from "@/components/ui";

export default function SeletorDia({ dia, base }) {
  const router = useRouter();
  return (
    <input
      type="date"
      value={dia}
      className={`${entradaCls} w-48`}
      onChange={(e) => router.push(`${base}?data=${e.target.value}`)}
    />
  );
}
