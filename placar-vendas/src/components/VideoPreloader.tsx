import React, { useMemo } from 'react';
import type { DashboardData } from '../services/SupabaseService';

interface VideoPreloaderProps {
  data: DashboardData;
}

/**
 * Componente responsável por realizar o pré-carregamento dos vídeos de celebração.
 * Ao renderizar elementos de vídeo ocultos com preload="auto", forçamos o navegador
 * a baixar os arquivos para o cache, eliminando o atraso (delay) quando a celebração inicia.
 */
export const VideoPreloader: React.FC<VideoPreloaderProps> = ({ data }) => {
  const videoUrls = useMemo(() => {
    const urls = new Set<string>();
    
    // Vídeo de meta da equipe (300 Mil)
    urls.add("/videos/Video 300 Mil.mp4");
    
    // Vídeos individuais dos vendedores baseados no primeiro nome
    data.teams.forEach(team => {
      team.sellers.forEach(seller => {
        const firstName = seller.name.split(" ")[0];
        if (firstName) {
          urls.add(`/videos/${encodeURIComponent(firstName)}.mp4`);
        }
      });
    });
    
    return Array.from(urls);
  }, [data]);

  // Renderiza os vídeos de forma invisível para forçar o cache do navegador
  return (
    <div 
      aria-hidden="true"
      style={{ 
        position: 'absolute', 
        width: '1px', 
        height: '1px', 
        padding: '0', 
        margin: '-1px', 
        overflow: 'hidden', 
        clip: 'rect(0, 0, 0, 0)', 
        whiteSpace: 'nowrap', 
        borderWidth: '0' 
      }}
    >
      {videoUrls.map((url) => (
        <video 
          key={url} 
          src={url} 
          preload="auto" 
          muted 
          playsInline
        />
      ))}
    </div>
  );
};
