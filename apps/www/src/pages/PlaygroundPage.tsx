import { Playground } from '../components/Playground';
import { Section } from '../components/Section';

interface Props {
  sampleId: string;
  onSampleChange: (id: string) => void;
  customCode: string | null;
  onClearCustom: () => void;
}

export function PlaygroundPage({ sampleId, onSampleChange, customCode, onClearCustom }: Props) {
  return (
    <Section
      id="playground"
      eyebrow="Playground"
      title="Try it"
      lead="Type .aui on the left. Watch the live preview, the canonical AST, and the generated React update instantly."
    >
      <Playground sampleId={sampleId} onSampleChange={onSampleChange} customCode={customCode} onClearCustom={onClearCustom} />
    </Section>
  );
}
