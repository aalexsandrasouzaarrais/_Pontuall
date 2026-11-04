import React, { useEffect } from 'react';
import { useTheme } from '@/shared/context/ThemeContext';

interface LandingViewProps {
  onGoToLogin: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onGoToLogin }) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    document.title = 'Pontual | Gestão de equipes';

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'PONTUAL_OPEN_LOGIN') {
        if (data.theme === 'light' || data.theme === 'dark') {
          setTheme(data.theme);
        }
        onGoToLogin();
      } else if (data.type === 'PONTUAL_THEME_CHANGE') {
        if (data.theme === 'light' || data.theme === 'dark') {
          setTheme(data.theme);
        }
      } else if (data.type === 'PONTUAL_TITLE_CHANGE' && typeof data.title === 'string') {
        document.title = data.title;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onGoToLogin, setTheme]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0c0a0d] overflow-hidden z-50">
      <iframe
        src="./lp/index.html"
        title="Pontual | Gestão de equipes"
        className="w-full h-full border-0 block"
      />
    </div>
  );
};
