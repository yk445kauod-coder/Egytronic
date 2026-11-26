import Legal, { type LegalKind } from "../../pages/Legal";

export default function LegalEn({ kind }: { kind: LegalKind }) {
  return <Legal locale="en" kind={kind} />;
}
