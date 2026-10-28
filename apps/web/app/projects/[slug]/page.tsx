import { ProjectDetails } from "@/components/project-details";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProjectDetails key={slug} id={slug} />;
}
