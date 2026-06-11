import { useEffect } from 'react';
// @ts-ignore
import { loadQualtrics, resetLoader } from './QualtricsLoader';

interface Props {
  userId: string;
}

export default function QualtricsWidget({ userId }: Props) {
  useEffect(() => {
    loadQualtrics(userId);
    return () => resetLoader();
  }, [userId]);

  return null;
}
