export interface imageResponse {
    uid?: string,      // unique identifier, negative is recommend, to prevent interference with internal generated id
    name?: string,   // file name
    status?: string, // options：uploading, done, error, removed. Intercepted file by beforeUpload don't have status field.
    response?: string, // response from server
    linkProps?: string, // additional html props of file link
    xhr?: string
}