import HierarchyBuilder from "../components/hierarchy/HierarchyBuilder";
import HierarchyPanel from "../components/hierarchy/HierarchyPanel";

export default function Hierarchies() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <HierarchyBuilder />
        <HierarchyPanel />
      </div>
    </div>
  );
}
