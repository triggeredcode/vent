import { notFound } from "next/navigation";
import { SceneLab } from "./scene-lab";

/** Dev-only preview of the call scenes: /lab?scene=punch&phase=hearing&tone=fired_up */
export default async function LabPage({ searchParams }: PageProps<"/lab">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  return <SceneLab scene={pick("scene")} phase={pick("phase")} tone={pick("tone")} />;
}
