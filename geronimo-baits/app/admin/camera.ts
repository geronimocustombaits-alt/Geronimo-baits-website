// True if this device has a camera the browser can see. On a PC without a
// webcam this is false, so tapping the scan block just readies the handheld
// scanner instead of showing a camera error.
export async function hasCamera() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return false;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === "videoinput");
  } catch {
    return false;
  }
}
