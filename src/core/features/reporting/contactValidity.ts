import { contactCountryCodes, usPostalStates } from '../../shared/contactAddress'
import { sqlTextWithin } from './textValidity'

/** Aggregate guards return only counts; ledger/export also check canonical JS values. */
export function contactValidity(json: string) {
  const at = (key: string) => `json_extract(${json}, '$.${key}')`
  const kind = (key: string) => `json_type(${json}, '$.${key}')`
  const digits = (value: string) => `length(${value})>0 AND ${value} NOT GLOB '*[^0-9]*'`
  const quoted = (values: readonly string[]) => values.map(value => `'${value}'`).join(',')
  const whitespace = 'char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)'
  const text = (value: string, max: number, nonempty: boolean) => `${sqlTextWithin(value, max)}
    AND ${value}=trim(${value},${whitespace}) ${nonempty ? `AND length(CAST(${value} AS BLOB))>0` : ''}
    AND NOT EXISTS(WITH RECURSIVE controls(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM controls WHERE n<31)
      SELECT 1 FROM controls WHERE instr(CAST(${value} AS BLOB),CAST(char(n) AS BLOB))>0)
    AND instr(CAST(${value} AS BLOB),x'7f')=0`
  const field = (key: string, max: number, nonempty = true) => `(${kind(key)}='text' AND ${text(at(key), max, nonempty)})`
  const optional = (key: string, max: number) => `(${kind(key)} IS NULL OR ${field(key, max)})`
  const object = (keys: string[]) => `json_type(${json})='object'
    AND NOT EXISTS(SELECT 1 FROM json_each(${json}) WHERE key NOT IN (${quoted(keys)}))
    AND (SELECT count(*)=count(DISTINCT key) FROM json_each(${json}))`
  const number = at('number'), extension = at('extension'), postal = at('postalCode')
  const phone = `${object(['number', 'extension'])} AND ${kind('number')}='text'
    AND ${digits(`substr(${number},2)`)}
    AND ((${number} GLOB '+[2-9]*' AND length(${number}) BETWEEN 9 AND 16)
      OR (length(${number})=12 AND substr(${number},1,2)='+1' AND substr(${number},3,1) BETWEEN '2' AND '9' AND substr(${number},6,1) BETWEEN '2' AND '9'))
    AND (${kind('extension')} IS NULL OR (${kind('extension')}='text' AND length(${extension}) BETWEEN 1 AND 10 AND ${digits(extension)}))`
  const address = `${object(['street', 'unit', 'city', 'state', 'postalCode', 'country'])}
    AND ${field('street', 200)} AND ${optional('unit', 100)} AND ${field('city', 100)}
    AND ${field('state', 100, false)} AND ${field('postalCode', 20, false)} AND ${field('country', 2)}
    AND ${at('country')} IN (${quoted(contactCountryCodes)})
    AND (${at('country')}!='US' OR (${at('state')} IN (${quoted(usPostalStates)}) AND (
      (length(${postal})=5 AND ${digits(postal)}) OR (length(${postal})=10 AND substr(${postal},6,1)='-' AND ${digits(`substr(${postal},1,5)||substr(${postal},7)`)}))))`
  const name = `${object(['given', 'middle', 'family', 'suffix'])}
    AND ${field('given', 100)} AND ${optional('middle', 100)} AND ${field('family', 100)} AND ${optional('suffix', 30)}`
  const currency = `${object(['currency', 'minorUnits'])} AND ${at('currency')}='USD'
    AND ${kind('minorUnits')} IN ('integer','real') AND ${at('minorUnits')}=CAST(${at('minorUnits')} AS INTEGER)
    AND ${at('minorUnits')} BETWEEN -9007199254740991 AND 9007199254740991`
  const value = `json_extract(${json}, '$')`
  const authority = `substr(${value},instr(${value},'://')+3,instr(substr(${value},instr(${value},'://')+3),'/')-1)`
  const url = `json_type(${json})='text' AND ${text(value, 2048, true)}
    AND (${value} GLOB 'http://*/*' OR ${value} GLOB 'https://*/*') AND length(${authority})>0
    AND instr(${value},char(92))=0
    AND NOT EXISTS(SELECT 1 FROM json_each(json_array(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)) WHERE instr(${value},char(value))>0)`
  return `WHEN 'phone' THEN ${phone}
    WHEN 'postal_address' THEN ${address}
    WHEN 'full_name' THEN ${name}
    WHEN 'currency' THEN ${currency}
    WHEN 'url' THEN ${url}`
}
