export interface fileResponse {
    filepath: string,
    newFilename: string,
    originalFilename: string | null,
    mimetype: string | null,
    size: number,
    uid?: string,
    status?: string,
    url?: string
}