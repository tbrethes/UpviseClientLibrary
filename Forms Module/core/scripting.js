
/////  Javascript Form scripting: on submit javascript custom code

Forms.newQuote = function (formid) {
    var form = Query.selectId("Forms.forms", formid);
    var asset, site;
    var companyid = "";
    var description = "";
    if (form.linkedtable == "Assets.assets") {
        var asset = Query.selectId("Assets.assets", form.linkedid);
        if (asset != null) {
            var site = Query.selectId("Assets.locations", asset.locationid);
            companyid = (site != null) ? site.companyid : asset.companyid;
        }
    } else if (form.linkedtable == "Assets.locations") {
        var site = Query.selectId("Assets.locations", form.linkedid);
        companyid = (site != null) ? site.companyid : "";
    }

    description = Forms.getDescription(form.id);
    var onclick = "Sales.newQuote('companyid',{companyid},{description})";
    History.redirect(onclick);
    return 2; // success do not navigate
}

Forms.getDescription = function (id) {
    var desc = [];
    var form = Query.selectId("Forms.forms", id)
    var fields = Forms.getFields(form);
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        if (field.value != "" && field.type != "signature" && field.type != "photo" && field.type != "button") desc.push(field.label + ": " + field.value);
    }
    return desc.join("<br/>");
}

Forms.getTemplateId = function (name) {
    var templates = Query.select("Forms.templates", "id", "name={name}");
    if (templates.length == 0) templates = Query.select("Forms.templates", "id", "prefix={name}");
    return (templates.length > 0) ? templates[0].id : null;
}

Forms.createForm = function (name, linkedtable, linkedid, values) { // QUESTION Should we also support counterid here?
    var templateid = Forms.getTemplateId(name);
    if (templateid == null) { App.alert("No Template not found!"); return 1; }

    var formid = Forms.newFormInternal(templateid, linkedtable, linkedid, values);

    History.add(Forms._VIEWFORM + "({formid})");
    if (WEB() || Config.appid == "Forms") History.redirect(Forms._EDITFORM + "({formid})");
    else App.open(Forms._EDITFORM + "({formid})"); // bug on mobile.....
    return 2;
}

Forms.createJob = function (toolid) {
    if (WEB() || Config.appid == "Jobs") History.redirect("Jobs.newToolJob({toolid})");
    else App.open("Jobs.newToolJob({toolid})"); // bug on mobile.....
    return 2;
}

Forms.emailCsv = function (emails, id) {
    var form = Query.selectId("Forms.forms", id);

    var filename = Query.names("Forms.templates", form.templateid) + " " + form.name;
    if (Format.forprint != null) Format.forprint();

    var csv = new CsvFile();
    csv.writeLine(["Form ID", filename]);
    csv.writeLine(["Submitted by", form.owner]);
    csv.writeLine(["Submitted Date", Format.datetime(form.date)]);

    var fields = Forms.getFields(form);
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        if (field.type != "signature" && field.type != "photo" && field.type != "button") {
            var value = CustomFields.formatValue(field.value, field.type, field.options);
            if (field.type == "longtext") value = Format.text(value);
            else if (field.type == "label" || field.type == "header") value = "";
            csv.writeLine([field.label, value]);
        }
    }

    var content = csv.getContent();
    var filename = filename + ".csv";
    Notif.sendCsv(emails, content, filename);
}

Forms.emailPdf = function (formid, email, subject, body) {
    FormsPdf.export(formid, "serveremail", email, subject, body);
}

// set the value for the current form only (last formid param is optional)
Forms.setValue = function (id, value, formid) {
    // if formid is not set, use the current _formid
    if (formid == null) formid = _formid;

    if (!formid || !id) return;
    
    var values = Forms._getValuesFromId(formid);
    values[id] = value;
    Query.updateId("Forms.forms", formid, "value", JSON.stringify(values));
}

// set the value for the current form only (last formid param is optional)
Forms.setValues = function (obj, formid) {
    // if formid is not set, use the current _formid
    if (formid == null) formid = _formid;
    if (!formid) return;

    var values = Forms._getValuesFromId(formid);
    for (var key in obj) {
        values[key] = obj[key];

    }
    Query.updateId("Forms.forms", formid, "value", JSON.stringify(values));
}


// second parameter formid is optional, if null, it means current form
Forms.getValue = function (fieldid, formid) {
    if (!fieldid) return ""; // error
    // if formid is not set, use the current _formid
    if (formid == null) formid = _formid;
    
    var values = Forms._getValuesFromId(formid);
    var value = values[fieldid];
    return value ? value  : "";
}

Forms.getIntValue = function (fieldid, formid) {
    return parseInt(Forms.getValue(fieldid, formid));
}

Forms.getFloatValue = function (fieldid, formid) {
    return parseFloat(Forms.getValue(fieldid, formid));
}


// second parameter formid is optional, if null, it means current form
Forms.getValuesForType = function (type, formid) {
    var form = Query.selectId("Forms.forms", formid);
    var values = Forms._getValues(form);
    var fields = Query.select("Forms.fields", "name", "formid={form.templateid} AND type={type}");
    var valueList = [];
    for (var i = 0; i < fields.length; i++) {
        valueList.push(values[fields[i].name]);
    }
    return valueList;
}

/////////////////////////////////////////////////

Forms.extractValue = function(buffer, label) {
    if (buffer == null) return "";
    var index = buffer.indexOf(label);
    if (index == -1) return "";
    index += label.length;
    var value = "";
    while (index < buffer.length) {
        var c = buffer.charAt(index);
        if (c == " " || c == "\n") {
            if (value.length > 0) break;
        } else {
            value += c;
        }
        index++;
    }
    return value;
}

Forms.setCustomField = function (table, id, name, value) {
    if (table == null || table == "" || id == "" || id == null) return;
    var obj = Query.selectId(table, id);
    if (obj == null || obj.custom == null) return;
    var custom = (obj.custom != "") ? JSON.parse(obj.custom) : {};
    custom[name] = value;
    Query.updateId(table, id, "custom", JSON.stringify(custom));
}

Forms.getCustomField = function (table, id, name) {
    if (table == null || table == "" || id == "" || id == null) return "";
    var obj = Query.selectId(table, id);
    if (obj == null || obj.custom == null) return;
    var custom = (obj.custom != "") ? JSON.parse(obj.custom) : {};
    var value = custom[name];
    return (value != null) ? value : "";
}

///////////////

Forms.getAllFields = function (form) {
    var where = "formid={form.templateid}";
    var fields = Query.select("Forms.fields", "name;label;value;type;seloptions;status;mandatory", where, "rank");
    var formValues = Forms._getFullValues(form, fields);

    var list = [];
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var field2 = {};
        field2.id = field.name;
        field2.label = field.label;
        field2.type = field.type;
        field2.options = field.seloptions;
        field2.mandatory = field.mandatory;

        var value = formValues[field.name];
        if (value == null) value = "";

        field2.value = value;

        list.push(field2);
    }
    return list;
}


Forms.selectDataset = function (name, orderby) {
    var sets = Query.select("Forms.datasets", "id", "name={name}");
    if (sets.length == 0) return [];
    var datasetid = sets[0].id;
    if (orderby == null) orderby = "name";
    return Query.select("Forms.dataitems", "code;name;id", "datasetid={datasetid}", orderby);
}

Forms.datasetOptions = function (name, orderby) {
    var items = Forms.selectDataset(name, orderby);
    var options = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var str = item.code ? item.code + ":" + item.name : item.name;
        options.push(str);
    }
    return options.join("|");
}

Forms.getForm = function (templateName, formName, linkedid) {
    var templateid = Forms.getTemplateId(templateName);
    if (templateid == null) return null;
    if (!formName && !linkedid) return null;
    var where = "templateid={templateid}";
    if (formName) where += " AND name={formName}";
    if (linkedid) where += " AND linkedid={linkedid}";
    var forms = Query.select("Forms.forms", "*", where);
    if (forms.length == 0) return null;
    var form = forms[0];
    var values = JSON.parse(form.value);
    return values;
}

// return a list of subform ids for this field
Forms.getFormIds = function (fieldname, formid) {
    if (formid == null) formid = _formid;
    var linkedid = formid + ":" + fieldname;
    var list = [];
    var subforms = Query.select("Forms.forms", "id", "linkedtable='Forms.forms' AND linkedid={linkedid}", "date DESC");
    for (var i = 0; i < subforms.length; i++) {
        list.push(subforms[i].id);
    }
    return list;
}

// returns a pipe separated string for options combo box. recordid is the id of the current record to be added to the option
// if not found in the where clause.
Forms.options = function (table, where, recordid) {
    var options = Query.options(table, where);
    var record = recordid ? Query.selectId(table, recordid) : null;
    // add id:label for the record if not found in the options
    if (record && options.indexOf(recordid + ":") == -1) options += "|" + record.id + ":" + record.name;
    return options;
}

Forms.getValuePhoto = function (fieldid, formid, maxSize) {
    var linkedrecid = formid + ":" + fieldid;
    var list = [];
    var totalSize = 0;
    var files = Query.select("System.files", "id;name;mime;size", "linkedtable='Forms.forms' AND linkedrecid={linkedrecid}", "date");
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (maxSize > 0 && totalSize + file.size > maxSize) {
            break;
        } else {
            totalSize += file.size;
            list.push({ fileName: file.name, fileType: file.mime, fileContent: file.id })
        }
    }
    return list;
}

Forms.formatEmails = function (str) {
    // remove any html tag
    var clean = Format.text(str);
    // find any valid email separator token
    var list = [];
    var index = 0;
    for (var i = 0; i <= clean.length; i++) {
        var c = clean.charAt(i);
        // c == "" is for the end of the string 
        if (c == "" || c == " " || c == ";" || c == "\n" || c == ",") {
            if (i > index) {
                var token = clean.substr(index, i - index);
                list.push(token);
            }
            index = i + 1;
        }
    }
    return list.join(";");  
}

Forms.getPhotoSize = function (form) {
    var size = 0;
    var fields = Query.select("Forms.fields", "name", "formid={form.templateid} AND type IN ('photo','drawing')");
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var linkedrecid = form.id + ":" + field.name;
        var files = Query.select("System.files", "size", "linkedtable='Forms.forms' AND linkedrecid={linkedrecid}");
        for (var j = 0; j < files.length; j++) {
            size += files[j].size;
        }
    }
    return size;
}

// NORDEX Usig it in forms....
Forms.cleanup = function (str) {
    return String(str).toLowerCase().replace(/[^a-zA-Z0-9]+/g, "");
}


///// SHOW / Hide FIELDS

Forms.showFields = function (toShow, toHide, formid) {
    if (!formid) formid = _formid; // get current one if not set
    // load the hidden field list
    if (!formid) return; // error
    var form = Query.selectId("Forms.forms", formid);
    if (!form) return;
    var hiddenFields = form.hidden ? JSON.parse(form.hidden) : [];
    var changed = false;

    for (var i = 0; i < toShow.length; i++) {
        var name = toShow[i];
        var index = hiddenFields.indexOf(name);
        // remove the field from the hidden array if it exist
        if (index !== -1) {
            hiddenFields.splice(index, 1);
            changed = true;
        }
    }

    for (var i = 0; i < toHide.length; i++) {
        var name = toHide[i];
        var index = hiddenFields.indexOf(name);
        // add the field to the hidden array if it does not exist already
        if (index == -1) {
            hiddenFields.push(name);
            changed = true;
        }
    }

    if (changed == true) {
        Query.updateId("Forms.forms", formid, "hidden", JSON.stringify(hiddenFields));
    }
}


Forms.showField = function (fieldName, yes) {
    if (yes) Forms.showFields([fieldName], []);
    else Forms.showFields([], [fieldName]);
}

Forms.showNextField = function (yes, count) {
    if (yes === undefined) yes = true;
    if (count === undefined) count = 1;

    if (!_formid) return; // error
    var form = Query.selectId("Forms.forms", _formid);
    if (!form || !Forms.field) return;

    var fieldNames = Forms.getNextFields(form.templateid, Forms.field.rank, count);
    var toShow = yes ? fieldNames : [];
    var toHide = !yes ? fieldNames : [];
    Forms.showFields(toShow, toHide);
}

// private
Forms.getNextFields = function (templateid, rank, count) {
    var fields = Query.select("Forms.fields", "name", "formid={templateid} AND rank>{rank}", "rank");
    var list = [];
    for (var i = 0; i < fields.length; i++) {
        list.push(fields[i].name);
        if (i == count - 1) break;
    }
    return list;
}



