import * as fsPromises from 'fs/promises'
import { Command } from 'commander';
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import pluralize from 'pluralize'
import * as path from 'path'
import { errorStyle, infoStyle } from '../textStyles';
import { TOOL_NAME } from '../constants';
import { getAbsolutePOSIXPath } from '../utils/absolutePosixPath';

// Options for the export-firestore command
interface ExportFirestoreOptions {
    keypath: string    
}

const exportFirestoreAction = async (options: ExportFirestoreOptions) => {
    let serviceAccount = {}

    try {
        serviceAccount = require(options.keypath)
    } catch (error: any) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error(errorStyle(`The serviceAccountKey was not found at ${options.keypath}`))   
        }
        process.exit(1)
    }

    initializeApp({
        credential: cert(serviceAccount)
    })

    const db = getFirestore()

    let filenames: string[] = []
    try {
        const absoluteDataDirectoryPath = getAbsolutePOSIXPath('./datagen')
        filenames = await fsPromises.readdir(absoluteDataDirectoryPath, {
            recursive: false
        })
    } catch (error: any) {
        if(error.code === 'ENOENT') {
            console.error(
                errorStyle(
                    `Couldn't find a datagen directory. Use the ${TOOL_NAME} generate command to create one. Run \`${TOOL_NAME} generate --help\` to learn more about the generate command.`
                ) 
            )
        }
        
        process.exit(1)
    }

    filenames.forEach(filename => {

        const filenameWithoutExtension = path.parse(filename).name
        const collectionName = pluralize(filenameWithoutExtension).toLowerCase()

        console.log(infoStyle(`Adding documents from ./datagen/${filename} to collection "${collectionName}"`));
        

        const absoluteFilePath = getAbsolutePOSIXPath(`./datagen/${filename}`)
        const data: object[] = require(absoluteFilePath)

        data.forEach(async obj => {
            await db.collection(collectionName).add(obj)
        })
    })
}


// Create the generate command
const exportFirestoreCommand = new Command()
                    .name('export-firestore')
                    .description("Exports the generated fake data to Google's Cloud Firestore Database")
                    .requiredOption(
                        '-k, --keypath <path>',
                        'The path to your service account key JSON file',
                        (value: any) => getAbsolutePOSIXPath(value) // transform input parameter
                    )
                    .action(exportFirestoreAction)


export { exportFirestoreCommand, exportFirestoreAction, ExportFirestoreOptions }
