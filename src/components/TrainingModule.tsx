import { useState } from "react";
import { 
  Play, 
  Video, 
  Clock, 
  Award, 
  HelpCircle, 
  Volume2, 
  Maximize2, 
  Minimize2, 
  ThumbsUp, 
  BookOpen,
  Pause
} from "lucide-react";
import { MasterclassVideo } from "../types";

interface TrainingModuleProps {
  videos: MasterclassVideo[];
  currency: string;
}

export default function TrainingModule({ videos, currency }: TrainingModuleProps) {
  
  // Local states
  const [selectedVideo, setSelectedVideo] = useState<MasterclassVideo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(35); // simulated percent
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});

  const handleOpenVideo = (video: MasterclassVideo) => {
    setSelectedVideo(video);
    setIsPlaying(true);
    setPlayerProgress(Math.floor(10 + Math.random() * 40)); // random start
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleLikeVideo = (videoId: string) => {
    setLikesCount(prev => ({
      ...prev,
      [videoId]: (prev[videoId] || 0) + 1
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Hero section explaining the goal */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
        <div className="space-y-1 max-w-xl">
          <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest font-mono">Universidade Corporativa OST</span>
          <h2 className="text-xl font-bold">Centro de Formação & Suporte Técnico</h2>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Aprenda a operar a plataforma como um mestre de vendas. Assista a tutoriais práticos gravados pelo idealizador do projeto <strong>Levi Domingos</strong> para optimizar a sua faturação, gerir o stock e garantir auditoria impecável de turnos.
          </p>
        </div>

        <span className="p-3 bg-slate-800 text-orange-400 rounded-2xl shrink-0 border border-slate-700">
          <BookOpen className="w-6 h-6 animate-pulse" />
        </span>
      </div>

      {/* 2. Grid list of preloaded masterclass courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {videos.map((vid) => {
          const currentLikes = (likesCount[vid.id] || 24);

          return (
            <div key={vid.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between group hover:border-slate-350 transition-all">
              
              {/* Thumbnail Mock Card */}
              <div 
                onClick={() => handleOpenVideo(vid)}
                className="bg-slate-950 aspect-video relative flex items-center justify-center cursor-pointer overflow-hidden"
              >
                {/* Visual banner overlay with opacity */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-slate-800/20 group-hover:scale-105 transition duration-300 flex items-center justify-center">
                  <span className="text-4xl filter grayscale opacity-45">{vid.category === "Vendas" ? "🛍️" : vid.category === "Stock" ? "📦" : "🏦"}</span>
                </div>

                {/* Duration sticker */}
                <span className="absolute bottom-2.5 right-2.5 bg-slate-900/80 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {vid.duration}
                </span>

                {/* Play hover circles overlay */}
                <span className="w-11 h-11 rounded-full bg-orange-500/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition z-10">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </span>

                <span className="absolute top-2.5 left-2.5 bg-white/10 backdrop-blur text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                  {vid.category}
                </span>
              </div>

              {/* Title & metadata content */}
              <div className="p-4.5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-850 text-xs md:text-sm line-clamp-1 group-hover:text-orange-600 transition">{vid.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{vid.description}</p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                  <span>Instrutor: <strong className="text-slate-600 font-bold">{vid.instructor}</strong></span>

                  <button
                    onClick={() => handleLikeVideo(vid.id)}
                    className="flex items-center gap-1 hover:text-slate-700 transition cursor-pointer font-bold"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
                    {currentLikes} Gostos
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* 3. SIMULATED INTERACTIVE VIDEO PLAYER MODAL OVERLAY */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 text-white p-5 rounded-2xl max-w-2xl w-full border border-slate-800 shadow-2xl space-y-4 animate-in zoom-in duration-200">
            
            {/* Header of player */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <div>
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest font-mono">A Exibir Masterclass</span>
                <h3 className="font-bold text-[13.5px] text-slate-100">{selectedVideo.title}</h3>
              </div>
              <button 
                onClick={() => { setSelectedVideo(null); setIsPlaying(false); }}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                Fechar Aula X
              </button>
            </div>

            {/* Video Canvas screen */}
            <div className="aspect-video bg-slate-950 rounded-xl relative overflow-hidden border border-slate-800 flex flex-col justify-between p-4 [perspective:1000px]">
              
              {/* 3D Interactive Software Simulation Render */}
              <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                {isPlaying ? (
                  <div className="w-full h-full relative flex items-center justify-center">
                    {/* Perspective grid background */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.04)_1px,transparent_1px)] bg-[size:24px_24px] [transform:rotateX(60deg)_translateY(-30%)] opacity-60"></div>
                    
                    {/* Course Category Specific 3D Rendering */}
                    {selectedVideo.category === "vendas" && (
                      <div className="relative w-72 h-44 [transform:rotateY(-15deg)_rotateX(15deg)] [transform-style:preserve-3d] transition duration-700 animate-in fade-in">
                        {/* 3D Floating POS App Window */}
                        <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-3 shadow-2xl flex flex-col justify-between [transform:translateZ(20px)]">
                          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                            <span className="text-[8px] font-mono font-bold text-orange-400">POS TERMINAL CORE</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          </div>
                          
                          <div className="space-y-1 my-1">
                            <div className="bg-slate-900/60 p-1.5 rounded-lg flex justify-between text-[8px] items-center border border-white/5">
                              <span className="font-sans text-slate-200">🛒 Carrinho: 2 Items</span>
                              <span className="text-orange-300 font-bold">1,250 MT</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[7px] text-slate-300">
                              <span className="bg-white/5 p-0.5 rounded text-center">Arroz Fino x1</span>
                              <span className="bg-white/5 p-0.5 rounded text-center">Óleo Puro x1</span>
                            </div>
                          </div>
                          
                          <div className="bg-orange-500 text-white text-[8px] font-extrabold text-center py-1 rounded-lg tracking-wider uppercase font-mono shadow-md shadow-orange-500/20">
                            PAGAMENTO PROCESSADO ✓
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedVideo.category === "caixa" && (
                      <div className="relative w-64 h-44 [transform:rotateY(10deg)_rotateX(20deg)] [transform-style:preserve-3d] flex items-center justify-center animate-in fade-in">
                        <div className="absolute inset-x-4 h-16 bg-slate-800 rounded-lg flex flex-col justify-end p-2 border border-slate-700 [transform:translateZ(-10px)]">
                          <span className="text-[7px] font-mono text-slate-500 block text-center">CAIXA REGISTADORA FISCAL</span>
                        </div>
                        <div className="absolute inset-x-2 bottom-6 h-14 bg-orange-500/90 rounded-lg p-2.5 border border-orange-400 flex justify-between items-center [transform:translateZ(30px)] shadow-2xl">
                          <div>
                            <span className="text-[8px] font-bold text-slate-950 block leading-none">GAVETA DE VALORES</span>
                            <span className="text-[6.5px] text-orange-950">Fecho do Turno</span>
                          </div>
                          <span className="text-xs font-bold text-white font-mono">18,450 MT</span>
                        </div>
                      </div>
                    )}

                    {selectedVideo.category === "stock" && (
                      <div className="relative w-60 h-40 [transform:rotateY(-20deg)_rotateX(10deg)] [transform-style:preserve-3d] flex flex-col items-center justify-center animate-in fade-in">
                        <div className="w-24 h-24 bg-amber-850 rounded-lg border border-amber-900 shadow-2xl p-2.5 flex flex-col justify-between [transform:translateZ(10px)] font-sans">
                          <span className="text-[6px] font-mono text-amber-200 block text-center">PRODUTO #33190</span>
                          <span className="font-mono text-center block">📦 Lote Ativo</span>
                          <span className="text-[6px] bg-red-500/25 border border-red-500/30 text-rose-400 font-extrabold rounded p-0.5 text-center block">Stock Mínimo: 3u</span>
                        </div>
                        <div className="absolute inset-x-0 h-0.5 bg-red-650 shadow-[0_0_12px_#ef4444] animate-pulse z-10 [transform:translateZ(20px)]"></div>
                      </div>
                    )}

                    {selectedVideo.category === "relatorios" && (
                      <div className="relative w-72 h-44 [transform:rotateY(15deg)_rotateX(15deg)] [transform-style:preserve-3d] flex items-center justify-center animate-in fade-in">
                        <div className="absolute inset-0 bg-slate-900/50 rounded-xl border border-white/15 p-3.5 shadow-2xl flex flex-col justify-between [transform:translateZ(20px)]">
                          <span className="text-[8px] font-mono text-slate-400 block border-b border-white/5 pb-1 uppercase">ESTATÍSTICAS AUTOMÁTICAS</span>
                          <div className="flex justify-around items-end h-16 px-1">
                            <div className="w-3.5 bg-orange-400 rounded-t h-1/4"></div>
                            <div className="w-3.5 bg-orange-500 rounded-t h-2/4"></div>
                            <div className="w-3.5 bg-emerald-500 rounded-t h-3/4 animate-pulse"></div>
                            <div className="w-3.5 bg-blue-500 rounded-t h-5/6"></div>
                          </div>
                          <span className="text-[7.5px] font-mono font-bold text-center text-emerald-400">IVA LIQUIDADO: 16% REGISTADO</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 text-center flex flex-col items-center justify-center max-w-xs animate-in fade-in duration-300">
                    <Video className="w-16 h-16 text-slate-800 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{selectedVideo.instructor} • {selectedVideo.duration}</span>
                    <p className="text-[10.5px] text-slate-450 italic mt-1 leading-normal">
                      Pressione Reproduzir para carregar o demonstrativo 3D interativo e ilustrado do módulo!
                    </p>
                  </div>
                )}
              </div>

              {/* Status badge and speaker subtitle */}
              <div className="flex justify-between items-start z-10">
                <span className="bg-red-650 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
                  {isPlaying ? "REPRODUZINDO DEMO 3D" : "EM PAUSA"}
                </span>
                
                <span className="text-[9.5px] bg-slate-900/60 font-mono text-slate-300 p-1 rounded border border-white/5">
                  Codec: OST-3D-RENDER
                </span>
              </div>

              {/* Subtitles Simulation */}
              <div className="text-center z-10 bg-slate-900/80 p-2.5 rounded-lg max-w-md mx-auto border border-slate-800">
                {isPlaying ? (
                  <p className="text-xs text-orange-300 font-sans italic">
                    {selectedVideo.category === "vendas" && "... e com isso, o POS efetua a baixa de stock imediatamente de forma real e integrada à nossa base de base existencial."}
                    {selectedVideo.category === "caixa" && "... lembrando que ao fechar o turno, o supervisor valida o balancete de forma homologada e o caixa baixa o arquivo PDF com um clique."}
                    {selectedVideo.category === "stock" && "... o sistema avisa na hora se algum produto bater o limite mínimo ou se aproximar do prazo de vencimento."}
                    {selectedVideo.category === "relatorios" && "... o envio automático pode ser parametrizado para horas específicas do dia para ser enviado por SMTP real ao administrador."}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic font-mono">Aula comercial suspensa. Pressione Reproduzir para continuar a lição 3D do sistema.</p>
                )}
              </div>

              {/* Player Controllers */}
              <div className="z-10 bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-2.5">
                {/* Timeline seeker */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden relative cursor-pointer">
                    <div 
                      className="bg-orange-500 h-1 rounded-full absolute left-0"
                      style={{ width: `${playerProgress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-400 leading-none">
                    <span>{isPlaying ? `01:${Math.floor(playerProgress * 0.4)}` : "00:00"}</span>
                    <span>{selectedVideo.duration}</span>
                  </div>
                </div>

                {/* Buttons controls bar */}
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTogglePlay}
                      className="bg-orange-500 text-white rounded-full p-1.5 hover:bg-orange-600 cursor-pointer transition"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-white" />
                      ) : (
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      )}
                    </button>

                    <div className="flex items-center gap-1 text-[10.5px]">
                      <Volume2 className="w-4 h-4 text-slate-400" />
                      <span>Volume: 100%</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 shrink-0">Qualidade de Estúdio: 1080p FHD</span>
                </div>
              </div>

            </div>

            {/* Video footer details */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
              <Award className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="font-bold text-slate-200">Ganhe o seu Certificado de Proficiência OST Vendas</p>
                <p className="text-[10.5px] mt-0.5">Assista a todas as lições gravadas do Centro de Formação para habilitar sua qualificação de Especialista em Faturamento.</p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
