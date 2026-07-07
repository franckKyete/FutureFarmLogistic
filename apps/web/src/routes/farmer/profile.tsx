import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/profile')({
  component: FarmerProfilePage,
});

function FarmerProfilePage() {
  const navigate = useNavigate();

  // Profile editable state
  const [isEditing, setIsEditing] = useState(false);
  const [profileName, setProfileName] = useState('Verdant Valley Estates');
  const [profileBio, setProfileBio] = useState(
    'Premium Organic Soy & Corn Specialist since 2018. Focused on sustainable yield and high-precision logistics.'
  );

  const [tempName, setTempName] = useState(profileName);
  const [tempBio, setTempBio] = useState(profileBio);

  const handleSave = () => {
    setProfileName(tempName);
    setProfileBio(tempBio);
    setIsEditing(false);
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] font-sans min-h-screen pb-20">
      {/* Top App Bar */}
      <header className="bg-[#f8f9ff] sticky top-0 z-[60] w-full border-b border-[#c0c9be] flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#004322]" style={{ fontVariationSettings: "'FILL' 1" }}>
            agriculture
          </span>
          <h1 className="text-[20px] font-bold text-[#004322]">Future Farm</h1>
        </div>
        <div className="w-10 h-10 rounded-full border border-[#c0c9be] overflow-hidden">
          <img
            className="w-full h-full object-cover"
            alt="Profil"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCilJ341BkjQr01s8vaM1fHiLfmJ8FH6xR1MSpT6y7-LgZosDjE-8i2TYfQG4wc_WB2MOb-kZGJXJCCKLMAakEQeypFgZppK5dPayA0-4q7q3BZKc3hj4LEljZ92pslGLeOTkfY_erqd3sNwRWZj0slxyZuUoj3_DwiA0wlrprgol0_LRC78DYdO8699xCn_Vud8kSwgQqlPdw7W_jEJnjZJoJUgJt56F-8UF2i9Ss2V8W5YfxrMy0CYhP7j-5MeBcDfZTguBMaWVs"
          />
        </div>
      </header>

      <main className="max-w-[480px] mx-auto pb-8">
        {/* Hero Section: Banner & Profile Photo */}
        <section className="relative">
          <div className="h-48 w-full bg-[#e5eeff] overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt="Farm Banner"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2RL1OKEY-XQ2UuwmvozzMhoe3ofXaXoBvajdFQbNVCIN_ZuSErRRFRu87yBALfQzi_LfXU49J63XN_BIGE5ZMXZtF-omp1wHTXZ74Tmjs9mpWTQxRwPbXIGDYW8BFKoOFbxwbnz7Dz0D5aqrLbkPRo3az-3nCM53UGvoCE6_aPLoNyG72mdL1S0-a7TYWG82plHAxIVSuLtGgiEgozCkG8qIVYoz2Nb2YXa3vTms_WRg9OSfFqt5JdeCIynDKW3u5UR817z9a68I"
            />
          </div>
          <div className="px-4 -mt-12 relative z-10">
            <div className="flex items-end justify-between">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-[#f8f9ff] bg-[#ffffff] overflow-hidden shadow-sm">
                  <img
                    className="w-full h-full object-cover"
                    alt="Farmer Expert"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBB1d9ebDFsj90_z8xiICMnVdEBYVya8fW6hkOkTMa1NylxNqtf4w1mG0oicw6QhDftK4B-dS9r-Ho0WhCKYH10uNAmf7FOLFCgOoPOGrt4D_gi1wH_Vbao6x4IKOkP6MyF6RQuqvWg78M3NAE97AfFYrKQyXpWaw0_aJ5-c4twzbsiwZCc9C8HqRWD5pX684CewN2O0-6HsGJMFJIZ3GUJbt-ciCFf_1h_3cq2lefj037z7Nk-woMHK6HT1Xt9al4dOa77uqZI24E"
                  />
                </div>
                <div className="absolute bottom-0 right-0 bg-[#004322] text-white rounded-full p-1 border-2 border-[#f8f9ff]">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    setTempName(profileName);
                    setTempBio(profileBio);
                    setIsEditing(true);
                  }}
                  className="bg-[#004322] text-white px-4 py-2 rounded-lg font-semibold text-[12px] flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Identity & Stats Section */}
        <section className="px-4 mt-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold text-[#0b1c30]">{profileName}</h2>
            <span className="material-symbols-outlined text-[#1a5c35]">verified</span>
          </div>
          <p className="text-[14px] text-[#404941] mt-1">{profileBio}</p>
          <div className="grid grid-cols-4 gap-4 mt-6 bg-[#eff4ff] p-4 rounded-xl border border-[#c0c9be]">
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#004322]">24</p>
              <p className="text-[11px] text-[#404941]">Products</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#004322]">1.2k</p>
              <p className="text-[11px] text-[#404941]">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#885200]">98%</p>
              <p className="text-[11px] text-[#404941]">Quality</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#004322]">$42k</p>
              <p className="text-[11px] text-[#404941]">Revenue</p>
            </div>
          </div>
          <button
            onClick={() => void navigate({ to: '/farmer/analytics' })}
            className="w-full mt-3 border border-[#707970] text-[#004322] font-semibold text-[12px] py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#d3e4fe]/20 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            View Detailed Analytics
          </button>
        </section>

        {/* Active Products Section */}
        <section className="px-4 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-semibold">Active Listings</h3>
            <span className="text-[#004322] font-semibold text-[12px] cursor-pointer">View All</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {/* Product Card 1 */}
            <div className="bg-white border border-[#c0c9be] rounded-xl p-3 flex flex-col gap-3">
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    className="w-full h-full object-cover"
                    alt="Soybeans"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDeeYj5_IyEZ6gu40a2MX1c0wBsXfI47UFrB0m8ze567CPCfZT4znJ7IhHiwW1nl8xx-Taf5lsGIihSQTadnXpyBB3q_xf1-mbi0OyVuwY0hHEBjrgJ2T8WjCktmNjubVfrWctpXiW1m0W10Gd2alzgScVMLwi4ELJLdAw-p_SGOGExXCrZA0D_JJ0OmYnoYWDM_aM7Sh98lj63TmKIc3J6pIUZ2o7ixCnKEtzwcWagauAOoyfdbTtb5g21o3VFGjYWDu4tOJ5KzCk"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#0b1c30]">Premium Soybeans</h4>
                      <p className="text-[10px] text-[#004322] font-bold uppercase">Légumineuses</p>
                    </div>
                    <span className="bg-[#aef2be] text-[#00210d] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                      92% Qualité
                    </span>
                  </div>
                  <p className="text-[#404941] text-[11px] mt-1 font-semibold">Stock total : 4.2 Tonnes</p>
                  <p className="text-[#404941] text-[10px]">Dernière récolte : Octobre 2023</p>
                </div>
              </div>
              <div className="border-t border-[#c0c9be] pt-2">
                <p className="text-[10px] font-bold text-[#404941] mb-1">Historique récent :</p>
                <div className="flex gap-2">
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Oct: 92</div>
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Sept: 89</div>
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Août: 94</div>
                </div>
              </div>
            </div>

            {/* Product Card 2 */}
            <div className="bg-white border border-[#c0c9be] rounded-xl p-3 flex flex-col gap-3">
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    className="w-full h-full object-cover"
                    alt="Yellow Dent Corn"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwekWrXEp0Pdd5Z6zL2dqgKC8C9jmZ1Nj9DXcqlDktb7l16WOyP2-5cSfBvJyRKzI_HQfi17eJmfaMe79Owxrmf6LqbjRoqyIgOBmWRLEsKbyBBQQBRmrAHENmLLiSitFvUnZ6c0W_FmSHP3CmgRoznnmNQWkMStalJlIY2UvLVl5xL7FiZWdSLuBSV9C_hk_xvCzyqFM0SYjPEFZ-opxxMJJ5JZRCBGIXIq0KH6NCIjQOcT1apwjrRQkAm3ZHWLJ6Re_zMLKiaQo"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#0b1c30]">Yellow Dent Corn</h4>
                      <p className="text-[10px] text-[#885200] font-bold uppercase">Céréales</p>
                    </div>
                    <span className="bg-[#ffddbb] text-[#2b1700] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                      88% Qualité
                    </span>
                  </div>
                  <p className="text-[#404941] text-[11px] mt-1 font-semibold">Stock total : 12.0 Tonnes</p>
                  <p className="text-[#404941] text-[10px]">Dernière récolte : Septembre 2023</p>
                </div>
              </div>
              <div className="border-t border-[#c0c9be] pt-2">
                <p className="text-[10px] font-bold text-[#404941] mb-1">Historique récent :</p>
                <div className="flex gap-2">
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Sept: 88</div>
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Août: 85</div>
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Juil: 90</div>
                </div>
              </div>
            </div>

            {/* Product Card 3 */}
            <div className="bg-white border border-[#c0c9be] rounded-xl p-3 flex flex-col gap-3">
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    className="w-full h-full object-cover"
                    alt="Hard Red Wheat"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCoyP15YYxJPpyzOV-2m2U5_6FomPxRoH46zj97uKnIOTXzx4XCWd9oKLJ7MOPxc51HD4eiQaXbFDU0aAEbOjctrQDu6bwfqR6_DJgO8IbaLxnjF27yWy6oq6crSKUhOfz-S9ykplTx7KUuAO9--VVgveNyE77HJIHoWA6YhuIltQh12379aTG2RPipobktofOpPAdhKCASryPzFVAjbalZz0WUjTEtpwlLnPQjx4Yz3D1KkVrwQ5LPfn0XlXTUXM5u2NJEqiy3V3E"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#0b1c30]">Hard Red Wheat</h4>
                      <p className="text-[10px] text-[#004322] font-bold uppercase">Céréales d'hiver</p>
                    </div>
                    <span className="bg-[#aef2be] text-[#00210d] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                      95% Qualité
                    </span>
                  </div>
                  <p className="text-[#404941] text-[11px] mt-1 font-semibold">Stock total : 8.5 Tonnes</p>
                  <p className="text-[#404941] text-[10px]">Dernière récolte : Août 2023</p>
                </div>
              </div>
              <div className="border-t border-[#c0c9be] pt-2">
                <p className="text-[10px] font-bold text-[#404941] mb-1">Historique récent :</p>
                <div className="flex gap-2">
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Août: 95</div>
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Juil: 93</div>
                  <div className="bg-[#e5eeff] px-2 py-1 rounded text-[10px]">Juin: 91</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[400px] p-6 space-y-4">
            <h3 className="text-[18px] font-semibold text-[#004322]">Edit Profile</h3>
            <div className="space-y-2">
              <label className="text-[11px] text-[#404941] block">Name</label>
              <input
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px]"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] text-[#404941] block">Bio</label>
              <textarea
                rows={3}
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px]"
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-[#707970] rounded-lg text-[12px] font-semibold text-[#404941] hover:bg-[#eff4ff] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#004322] text-white rounded-lg text-[12px] font-semibold hover:bg-[#004322]/90 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f8f9ff] border-t border-[#c0c9be] flex justify-around items-center h-16 max-w-[480px] mx-auto px-2">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[12px] font-semibold">Home</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-[12px] font-semibold">Products</span>
        </Link>
        <Link
          to="/farmer/auctions"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">gavel</span>
          <span className="text-[12px] font-semibold">Auctions</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="text-[12px] font-semibold">Orders</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-[#004322] font-bold hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="text-[12px] font-semibold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
