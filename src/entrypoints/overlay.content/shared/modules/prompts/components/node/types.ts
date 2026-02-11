import { NodeRendererProps } from 'react-arborist';
import { NodeData } from '../../types';

export interface NodeProps extends NodeRendererProps<NodeData> {
  onPreview?: (prompt: any) => void;
}
