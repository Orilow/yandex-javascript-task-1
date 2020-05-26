'use strict';

/**
 * Телефонная книга
 */
const phoneBook = new Map();
const phoneRegExp = /^\d{10}$/;
const emailRegExp = /[\S]+/;
let lineNumber = 0;
let charNumber = 0;
let commands = [];

/**
 * Вызывайте эту функцию, если есть синтаксическая ошибка в запросе
 * @param {number} currentLineNumber – номер строки с ошибкой
 * @param {number} currentCharNumber – номер символа, с которого запрос стал ошибочным
 */
function syntaxError(currentLineNumber, currentCharNumber) {
    throw new Error('SyntaxError: Unexpected token at ' +
    `${Number(currentLineNumber) + 1}:${Number(currentCharNumber) + 1}`);
}

/**
 * Выполнение запроса на языке pbQL
 * @param {string} query
 * @returns {string[]} - строки с результатами запроса
 */
function run(query) {
    const splittedQuery = query.split(';');
    commands = splittedQuery;
    let result = [];
    lineNumber = 0;
    charNumber = 0;
    for (lineNumber; lineNumber < splittedQuery.length; lineNumber++) {
        let returned = handleTokens(splittedQuery[lineNumber].split(' '));
        result = addReturnedToResult(returned, result);
    }
    checkLastSemicolon();

    return result;
}

function checkLastSemicolon() {
    if (commands[commands.length - 1] !== '') {
        syntaxError(commands.length - 1,
            commands[commands.length - 1].length);
    }
}

function addReturnedToResult(returned, result) {
    if (typeof returned !== 'undefined') {
        if (result.length === 0) {
            result = returned;
        } else {
            result = [...result, ...returned];
        }
    }

    return result;
}

function handleTokens(tokens) {
    charNumber = 0;
    switch (tokens[0]) {
        case 'Создай':
            charNumber += 'Создай'.length + 1;
            handleCreateTokens(tokens.slice(1));
            break;
        case 'Удали':
            charNumber += 'Удали'.length + 1;
            handleDeleteTokens(tokens.slice(1));
            break;
        case 'Добавь':
            charNumber += 'Добавь'.length + 1;
            handleAdditionalInfo('add', tokens.slice(1));
            break;
        case 'Покажи':
            charNumber += 'Покажи'.length + 1;

            return handleShowTokens(tokens.slice(1));
        case '':
            handleEmptyString();
            break;
        default:
            syntaxError(lineNumber, charNumber);
    }
}

function handleEmptyString() {
    const index = commands.indexOf('');
    if (index !== commands.length - 1) {
        syntaxError(lineNumber, charNumber);
    }
}

function handleCreateTokens(tokens) {
    if (tokens[0] !== 'контакт') {
        syntaxError(lineNumber, charNumber);
    }
    createContact(tokens.slice(1));
}

function handleDeleteTokens(tokens) {
    if (tokens[0] === 'контакт') {
        deleteContact(tokens.slice(1));
    } else if (tokens[0] === 'телефон' || tokens[0] === 'почту') {
        handleAdditionalInfo('delete', tokens.slice(0));
    } else if (tokens[0] === 'контакты,') {
        handleMultipleDelete(tokens.slice(0));
    } else {
        syntaxError(lineNumber, charNumber);
    }
}

function handleShowTokens(tokens) {
    if (tokens[0] !== 'почты' && tokens[0] !== 'телефоны' && tokens[0] !== 'имя') {
        syntaxError(lineNumber, charNumber);
    }

    return handleSearchRequest(tokens);
}

function handleMultipleDelete(tokens) {
    let pattern = getRequestPatternFromTokens('delete', [], tokens).shift();
    if (pattern === '') {
        return;
    }
    let found = getRecordsByPatternInPhoneBook(pattern);
    if (found.length === 0) {
        return;
    }

    multipleDeleteFromPhoneBook(found);
}

function handleSearchRequest(tokens) {
    let requirements = getSearchRequirementsFromTokens([], tokens);
    if (requirements[0] === '') {
        return;
    }


    return searchRequested(requirements);
}

function searchRequested(req) {
    const pattern = req.shift();
    if (pattern === '') {
        return;
    }
    let suitableForPattern = getRecordsByPatternInPhoneBook(pattern);
    if (suitableForPattern.length === 0) {
        return;
    }

    return getRenderedSearchResult(req, suitableForPattern);
}

function getRenderedSearchResult(req, suitable) {
    let result = [];
    suitable.sort(sortContacts);
    for (let record of suitable) {
        let renderedStr = '';
        for (let r of req) {
            renderedStr += getRequestedParamFromRecord(record, r) + ';';
        }
        renderedStr = renderedStr.replace(/;$/, '');
        result.push(renderedStr);
    }

    return result;
}

function getRequestedParamFromRecord(record, request) {
    let renderedStr = '';
    switch (request) {
        case 'names':
            renderedStr += record[0];
            break;
        case 'phones':
            for (let phone of record[1].phones) {
                renderedStr += getRenderedPhone(phone) + ',';
            }
            renderedStr = renderedStr.replace(/,$/, '');
            break;
        case 'emails':
            for (let email of record[1].emails) {
                renderedStr += email + ',';
            }
            renderedStr = renderedStr.replace(/,$/, '');
            break;
        default:
            break;
    }

    return renderedStr;
}

function getRecordsByPatternInPhoneBook(pattern) {
    let suitableForPattern = [];
    for (let record of phoneBook) {
        if (record[0].includes(pattern)) {
            suitableForPattern.push(record);
        } else {
            suitableForPattern = suitableForPattern.concat(
                searchByPatternInRecordPhonesAndEmails(pattern, record));
        }
    }

    return suitableForPattern;
}

function searchByPatternInRecordPhonesAndEmails(pattern, record) {
    let suitableForPattern = [];
    for (let phone of record[1].phones) {
        if (phone.includes(pattern)) {
            suitableForPattern.push(record);

            return suitableForPattern;
        }
    }
    for (let email of record[1].emails) {
        if (email.includes(pattern)) {
            suitableForPattern.push(record);

            return suitableForPattern;
        }
    }

    return suitableForPattern;
}

function getSearchRequirementsFromTokens(req, tokens) {
    switch (tokens[0]) {
        case 'имя':
            charNumber += 'имя'.length + 1;
            req.push('names');

            return getSearchRequirementsFromTokens(req, tokens.slice(1));
        case 'почты':
            charNumber += 'почты'.length + 1;
            req.push('emails');

            return getSearchRequirementsFromTokens(req, tokens.slice(1));
        case 'телефоны':
            charNumber += 'телефоны'.length + 1;
            req.push('phones');

            return getSearchRequirementsFromTokens(req, tokens.slice(1));
        case 'и':
            charNumber += 'и'.length + 1;

            return getSearchRequirementsFromTokens(req, tokens.slice(1));
        case 'для':
            charNumber += 'для'.length + 1;

            return getRequestPatternFromTokens('show', req, tokens.slice(1));
        default:
            syntaxError(lineNumber, charNumber);
    }
}

function getRequestPatternFromTokens(mode, req, tokens) {
    makeRequestTokensPrechecks(mode, tokens);
    switch (tokens[3]) {
        case '':
            return [''];
        case undefined:
            return syntaxError(lineNumber, charNumber);
        default:
            req.unshift(tokens.slice(3).join(' '));

            return req;
    }
}

function makeRequestTokensPrechecks(mode, tokens) {
    if (mode === 'show') {
        if (tokens[0] !== 'контактов,') {
            syntaxError(lineNumber, charNumber);
        }
        charNumber += 'контактов,'.length + 1;
    } else {
        if (tokens[0] !== 'контакты,') {
            syntaxError(lineNumber, charNumber);
        }
        charNumber += 'контакты,'.length + 1;
    }
    if (tokens[1] !== 'где') {
        syntaxError(lineNumber, charNumber);
    }
    charNumber += 'где'.length + 1;
    if (tokens[2] !== 'есть') {
        syntaxError(lineNumber, charNumber);
    }
    charNumber += 'есть'.length + 1;
}

function handleAdditionalInfo(operation, tokens) {
    let addInfo = { name: null, phones: [], emails: [] };
    addInfo = getAdditionalInfoFromTokens(addInfo, tokens);
    if (phoneBook.has(addInfo.name)) {
        if (operation === 'add') {
            addAdditionalInfo(addInfo);
        } else {
            deleteAdditionalInfo(addInfo);
        }
    }
}

function getAdditionalInfoFromTokens(addInfo, tokens) {
    switch (tokens[0]) {
        case 'телефон':
            charNumber += 'телефон'.length + 1;
            makeAdditionalPrechecksForPhones(tokens);
            addInfo.phones.push(tokens[1]);
            charNumber += tokens[1].length + 1;

            return getAdditionalInfoFromTokens(addInfo, tokens.slice(2));
        case 'почту':
            charNumber += 'почту'.length + 1;
            makeAdditionalPrechecksForEmails(tokens);
            addInfo.emails.push(tokens[1]);
            charNumber += tokens[1].length + 1;

            return getAdditionalInfoFromTokens(addInfo, tokens.slice(2));
        case 'и':
            charNumber += 'и'.length + 1;
            makeAdditionalPrechecksForAnd(tokens);

            return getAdditionalInfoFromTokens(addInfo, tokens.slice(1));
        case 'для':
            charNumber += 'для'.length + 1;
            makeAdditionalPrechecksForFOR(addInfo, tokens);
            addInfo.name = tokens.slice(2).join(' ');

            return addInfo;
        default:
            syntaxError(lineNumber, charNumber);
    }
}

function makeAdditionalPrechecksForPhones(tokens) {
    if (!isValidPhoneNumber(tokens[1])) {
        syntaxError(lineNumber, charNumber);
    }
}

function makeAdditionalPrechecksForEmails(tokens) {
    if (!isValidEmail(tokens[1])) {
        syntaxError(lineNumber, charNumber);
    }
}

function makeAdditionalPrechecksForAnd(tokens) {
    if (tokens[1] !== 'телефон' && tokens[1] !== 'почту') {
        syntaxError(lineNumber, charNumber);
    }
}

function makeAdditionalPrechecksForFOR(addInfo, tokens) {
    // if (addInfo.)
    if (tokens[1] !== 'контакта') {
        syntaxError(lineNumber, charNumber);
    }
    charNumber += 'контакта'.length + 1;
    if (typeof tokens[2] === 'undefined') {
        syntaxError(lineNumber, charNumber);
    }
}

function createContact(tokens) {
    const name = tokens.join(' ');
    if (!phoneBook.has(name)) {
        phoneBook.set(name, { phones: [], emails: [], date: Date.now() });
    }
}

function deleteContact(tokens) {
    const name = tokens.join(' ');
    if (phoneBook.has(name)) {
        phoneBook.delete(name);
    }
}

function addAdditionalInfo(addInfo) {
    const name = addInfo.name;
    let newPhones = addInfo.phones;
    let newEmails = addInfo.emails;
    let contactPhones = phoneBook.get(name).phones;
    let contactEmails = phoneBook.get(name).emails;
    for (let phone of newPhones) {
        if (!contactPhones.includes(phone)) {
            contactPhones.push(phone);
        }
    }
    for (let email of newEmails) {
        if (!contactEmails.includes(email)) {
            contactEmails.push(email);
        }
    }
}

function deleteAdditionalInfo(addInfo) {
    const name = addInfo.name;
    let deletePhones = addInfo.phones;
    let deleteEmails = addInfo.emails;
    let contactPhones = phoneBook.get(name).phones;
    let contactEmails = phoneBook.get(name).emails;
    for (let phone of deletePhones) {
        if (contactPhones.includes(phone)) {
            const i = contactPhones.indexOf(phone);
            contactPhones.splice(i, 1);
        }
    }
    for (let email of deleteEmails) {
        if (contactEmails.includes(email)) {
            const i = contactEmails.indexOf(email);
            contactEmails.splice(i, 1);
        }
    }
}

function multipleDeleteFromPhoneBook(found) {
    for (let contact of found) {
        if (phoneBook.has(contact[0])) {
            phoneBook.delete(contact[0]);
        }
    }
}

function isValidPhoneNumber(phoneNumber) {
    return phoneRegExp.test(phoneNumber);
}

function isValidEmail(email) {
    return emailRegExp.test(email);
}

function getRenderedPhone(phone) {
    let result = '+7 ';
    result += '(' + phone.substring(0, 3) + ')';
    result += ' ' + phone.substring(3, 6) + '-' + phone.substring(6, 8) + '-' + phone.substring(8);

    return result;
}

function sortContacts(a, b) {
    if (a.date < b.date) {
        return -1;
    }
    if (a.date > b.date) {
        return 1;
    }

    return 0;
}

module.exports = { phoneBook, run };
