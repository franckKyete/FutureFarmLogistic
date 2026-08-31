import { useRef } from 'react';

export interface HarvestPhotoPickerProps {
  photos: string[];
  onChangePhotos: (photos: string[]) => void;
  featuredIndex: number;
  onSelectFeaturedIndex: (index: number) => void;
}

export function HarvestPhotoPicker({
  photos,
  onChangePhotos,
  featuredIndex,
  onSelectFeaturedIndex,
}: HarvestPhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('Failed to read photo file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          newPhotos.push(dataUrl);
        } catch {
          // Skip on read error
        }
      }
    }
    if (newPhotos.length > 0) {
      const updated = [...photos, ...newPhotos];
      onChangePhotos(updated);
      if (photos.length === 0) {
        onSelectFeaturedIndex(0);
      }
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    const updated = photos.filter((_, i) => i !== indexToRemove);
    onChangePhotos(updated);
    if (featuredIndex === indexToRemove) {
      onSelectFeaturedIndex(0);
    } else if (featuredIndex > indexToRemove) {
      onSelectFeaturedIndex(featuredIndex - 1);
    }
  };

  return (
    <div className="space-y-3 bg-[#f8f9ff] border border-[#c0c9be] p-4 rounded-xl">
      <div className="flex justify-between items-center">
        <div>
          <label className="text-[11px] font-bold text-[#404941] block">
            Photos de la récolte ({photos.length})
          </label>
          <p className="text-[10px] text-[#707970]">
            Cliquez sur une photo pour la définir comme image de couverture principale.
          </p>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGallerySelect}
        className="hidden"
      />

      {/* Photo Grid */}
      {photos.length === 0 ? (
        <div className="border-2 border-dashed border-[#c0c9be] rounded-xl p-5 text-center space-y-2 bg-white/60">
          <span
            className="material-symbols-outlined text-3xl text-[#707970]"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            add_a_photo
          </span>
          <p className="text-xs text-[#707970]">
            Aucune photo ajoutée pour ce lot de récolte.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((imgUrl, index) => {
            const isFeatured = index === featuredIndex;
            return (
              <div
                key={index}
                onClick={() => onSelectFeaturedIndex(index)}
                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-150 group border-2 ${
                  isFeatured
                    ? 'border-[#004322] ring-2 ring-[#004322]/20 scale-[1.02] shadow-sm'
                    : 'border-transparent hover:border-[#c0c9be]'
                }`}
              >
                <img
                  alt={`Photo de récolte ${index + 1}`}
                  className="w-full h-full object-cover"
                  src={imgUrl}
                />

                {/* Featured Badge */}
                {isFeatured && (
                  <div className="absolute top-1.5 left-1.5 bg-[#004322] text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5 shadow-sm">
                    <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                    Couverture
                  </div>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto(index);
                  }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                  title="Supprimer la photo"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 bg-[#004322] text-white py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
          Prendre une photo
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex-1 bg-white border border-[#c0c9be] text-[#004322] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer hover:bg-[#f0f4ff]"
        >
          <span className="material-symbols-outlined text-[16px]">photo_library</span>
          Galerie
        </button>
      </div>
    </div>
  );
}
