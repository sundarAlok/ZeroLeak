export const getPublicProfile = (uid, profile) => ({
  uid,
  name: profile.name || '',
  username: profile.username || '',
  bio: profile.bio || '',
  photoURL: profile.photoURL || null,
  urls: Array.isArray(profile.urls) ? profile.urls.filter(Boolean).slice(0, 3) : []
});
