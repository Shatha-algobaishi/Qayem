import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../../core/api/apiClient';
import { useAppSelector } from '../../../app/store';

export default function EvaluationStartPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const started        = useRef(false);
  const locale         = useAppSelector(s => s.ui.locale);
  const isAr           = locale === 'ar';

  const candidateId = searchParams.get('candidateId');
  const sessionId   = searchParams.get('sessionId');

  useEffect(() => {
    if (!candidateId || started.current) return;
    started.current = true;

    api.evaluations.start({ candidateId, sessionId: sessionId || null })
      .then(res => {
        const id = res.data;
        if (id) navigate(`/evaluations/${id}`, { replace: true });
        else navigate('/evaluations/my', { replace: true });
      })
      .catch(() => {
        navigate('/evaluations/my', { replace: true });
      });
  }, [candidateId, sessionId, navigate]);

  return (
    <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      {isAr ? 'جارٍ بدء التقييم...' : 'Starting evaluation...'}
    </div>
  );
}
