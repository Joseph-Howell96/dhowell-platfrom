/**
 * Making a photograph small enough to send.
 *
 * An iPad takes a twelve-megapixel picture of a receipt the size of a beer
 * mat: three to five megabytes of mostly lorry-cab upholstery. Two things
 * refuse that. A server action accepts one megabyte by default, and the
 * platform underneath caps a request at about four and a half whatever the
 * app says - so the ten megabytes this app advertised was never a promise it
 * could keep, and a real photograph was rejected before any of our code ran.
 *
 * Shrinking here rather than raising limits is the better answer anyway. It
 * uploads in a moment on a cab's mobile signal, it costs less to have read,
 * and none of it is detail anybody needed: two thousand pixels down the long
 * edge is more than enough to read the small print at the bottom of a
 * weighbridge ticket, which is the only thing on there that has to survive.
 *
 * Nothing here can stop a receipt being kept. Whatever cannot be shrunk - a
 * PDF, a HEIC the browser will not decode, a canvas that refuses - comes back
 * exactly as it went in, and the ordinary size check has the final word.
 */

/** The long edge, in pixels. Small print stays readable; the cab does not. */
const LONGEST_EDGE = 2000;

/** Below this there is nothing worth doing, so the original is kept. */
const ALREADY_SMALL = 600 * 1024;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= ALREADY_SMALL) return file;

  try {
    // from-image, because a phone writes "this is portrait" into the file
    // rather than rotating the pixels. Ignore that and a receipt arrives on
    // its side - still readable by a person turning their head, and markedly
    // less so by anything else.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, LONGEST_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      // 0.85 rather than higher: past that a photograph of paper gets bigger
      // without getting more readable, which is the whole thing we are trying
      // to avoid.
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });
    if (!blob || blob.size >= file.size) return file;

    // JPEG now, whatever it was - so the name says so, and so the server
    // stores it under a type that matches what is actually in it.
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // A HEIC this browser will not decode, or a canvas that refused. Send what
    // we were given and let the size check answer for it.
    return file;
  }
}
