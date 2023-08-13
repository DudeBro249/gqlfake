import { parse, ObjectTypeDefinitionNode, FieldDefinitionNode } from 'graphql/language'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import { faker } from '@faker-js/faker';
import ScopedEval from 'scoped-eval';
import { Command } from 'commander';
import { integerValidator } from '../utils'
import { GENERATE_DIRECTIVE_ARGUMENT_NAME, GENERATE_DIRECTIVE_NAME } from '../constants';
import { errorStyle } from '../textStyles';

// Options for the generate command
interface GenerateOptions {
    schemaPath: string
    numDocuments: number
}

const generateAction = async (options: GenerateOptions) => {

    // Check that the schema file exists
    if (!fs.existsSync(options.schemaPath)) {
        console.error(errorStyle(`File ${options.schemaPath} not found!`));
        process.exit(1)
    }
    
    // Read and parse schema
    const schemaContentBuffer = await fsPromises.readFile(options.schemaPath)
    const document = parse(schemaContentBuffer.toString())
  
    // Get all types defined in schema
    const definitions = document.definitions.filter(definition => definition.kind === 'ObjectTypeDefinition') as ObjectTypeDefinitionNode[]
  
    definitions.forEach(async definition => {

      const typeName = definition.name.value
  
      // documentsForType is initialized with NUM_DOCUMENTS empty objects
      const documentsForType: any[] = [...Array(options.numDocuments).keys()].map(i => {
        let emptyObj = {}
        return emptyObj
      })
  
      // Only process the type definitions that have fieldss
      if(definition.fields === undefined || definition.fields === null || definition.fields.length === 0) {
        return;
      }
  
      // Loop through all fields (properties) of a type (definition)
      for (let i = 0; i < definition.fields.length; i++) {
  
        let field: FieldDefinitionNode = definition.fields[i]
        const fieldName = field.name.value
        
        // Get all @generate directives next to a field
        const generateDirectives = (field.directives!.filter(directive => directive.name.value === GENERATE_DIRECTIVE_NAME))
  
        if (generateDirectives.length === 0) {
          // No @generate directives attached to field
          continue; // Move to next field
        }
  
        if (generateDirectives.length > 1) {
          console.error(
            errorStyle(
              `You cannot have more than 1 @${GENERATE_DIRECTIVE_NAME} directive next to one field. The erroneous field is "${fieldName}" under type "${typeName}"`
            )
          )
          process.exit(1)
        }
  
        // Get first (and only) @generate directive
        const generateDirective = generateDirectives[0]
        
  
        if (generateDirective.arguments === undefined || generateDirective.arguments.length === 0) {
          console.error(
            errorStyle(
              `Please apply the @${GENERATE_DIRECTIVE_NAME} directive into field "${fieldName}" under type "${typeName}"`
            )
          )
          process.exit(1)
        }
  
        if (generateDirective.arguments.length > 1) {
          console.error(
            errorStyle(
              `You have passed too many arguments into the @generate directive next to "${fieldName}" under type "${typeName}". Only one is allowed.`
            )
          )
          process.exit(1)
        }

  
        // Check that the generate directive has been passed an argument with the correct name
        const nameOfArgumentPassedIn = generateDirective.arguments[0].name.value
        if (nameOfArgumentPassedIn != GENERATE_DIRECTIVE_ARGUMENT_NAME) {
          console.error(
            errorStyle(
              `The @${GENERATE_DIRECTIVE_NAME} directive only accepts one argument called "${GENERATE_DIRECTIVE_ARGUMENT_NAME}" You passed in an argument called "${nameOfArgumentPassedIn}". The erroneous field is "${fieldName}" under type "${typeName}"`
            )
          )
          process.exit(1)
        }

        // Get data type passed into @generate's faker parameter
        const dataScript = (generateDirective.arguments[0].value as any).value as string
  
        const evaluator = new ScopedEval();
  
        // Generate fake data and put it into documentsForType
        for (let i = 0; i < options.numDocuments; i++) {
          const fakeData = evaluator.eval(dataScript, { faker: faker })
          documentsForType[i][fieldName] = fakeData
        }
      }
  
      // Export documentsForType to JSON
  
      if (!fs.existsSync(`./datagen/`)) {
        await fsPromises.mkdir(`./datagen/`, { recursive: true })
      }

      await fsPromises.writeFile(
        `./datagen/${typeName}.json`, 
        JSON.stringify(documentsForType, null, 2)
      )

    })
}


// Create the generate command
const generateCommand = new Command()
                    .name('generate')
                    .requiredOption(
                      '-s, --schema-path <path>', 
                      'The path to your GraphQL schema file'
                    )
                    .option<number>('-n, --num-documents <integer>',
                                    'The number of JSON objects to be generated per type defined in your GraphQL schema',
                                    (value, _) => integerValidator('--num-documents', value),
                                    1 // default value for --num-documents
                    )
                    .action(generateAction)


export { generateCommand }
