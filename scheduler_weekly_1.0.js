// 1. Script Begins
({
    //*************************************************************************
    // 2 - INFO
    //*************************************************************************
    Info:
    {   Title:"Weekly Scheduler  v1.0",
        Author:"Joan A. Llarch - Barcelona - August 2020",
        Version:"1.0",
        Description:"Scheduler all in one script",

        Setup:
        {   stringVarName:
            {   Widget:"LineEdit",
                MaxLength:32,
                Width:200,
                Name:"Persistent String Variable for Data"
            },
            interval:
            {   Widget:"ComboBox",
                Type:"Enum",
                Name:"Interval in Seconds Between Checkings",
                Items:[ 5, 15, 30 ],
            },
        },  
        Commands: 
        {   init_new_data: 
            {   Name: "Clear All Data",
                GroupName: "Setup",
                GroupOrder: "1",
                GroupCmdOrder: "1",
            },
            set_event: 
            {   Name: "Set Event",
                GroupName: "Event",
                GroupOrder: "1",
                GroupCmdOrder: "1",
                Params: {
                    dayNum: {
                        Type: "Enum",
                        Items: [ 0, 1, 2, 3, 4, 5, 6 ],
                        Name: "Day Number",
                    },
                    eventNum: {
                        Type: "Enum",
                        Items: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
                        Name: "Event Number",
                    },
                    taskActive: {
                        Name: "Task Active",
                        Type: "Enum",
                        Items: [ "Not Change", "Yes", "No" ],          
                    },
                    task: {
                        Name: "Task Name",
                        Wizard: "AllTaskNameSelector",
                    },
                    hourOperator: {
                        Name: "Hour Operator",
                        Type: "Enum",
                        Items: [ "Not Change", "=", "+", "-" ],          
                    },
                    hourNum: {
                        Name: "Hour",
                        Type: "Integer",
                        MinValue: 0,
                        MaxValue: 23,
                    },
                    minuteOperator: {
                        Name: "Minute Operator",
                        Type: "Enum",
                        Items: [ "Not Change", "=", "+", "-" ],          
                    },
                    minuteNum: {
                        Name: "Minute",
                        Type: "Integer",
                        MinValue: 0,
                        MaxValue: 59,
                    },
                },
            },
        },    
    },
    //*************************************************************************
    //  3 - SETUP VARIABLES
    //*************************************************************************
    Setup:
    {   stringVarName: "scheduler_data",
        interval: 5,
     },
    //*************************************************************************
    //  4 - DEVICE VARIABLES
    //*************************************************************************
    Device: 
    {   eventNumber: 0,
        lastError:"",
    },
    //*************************************************************************
    //  4b - LOCAL VARIABLES
    //*************************************************************************
    // "constants"
    DAYS_NUMBER: 7,
    EVENTS_BY_DAY: 10,
    // "constants" error variables
    error_no_json: "Invalid json format",
    // scheduler data object
    schedulerData: {},
    // minute saved
    minuteCurrent: 999,
    //*************************************************************************
    //  5 - PUBLIC FUNCTIONS
    //*************************************************************************
    set_event: function( dayNum, eventNum, taskActive, task, hourOperator, hourNum, minuteOperator, minuteNum ){
        var aux;
        this.Device.lastError = "";
        // to int
        var day = parseInt(dayNum, 10);
        var event = parseInt(eventNum, 10);
        var hour = parseInt(hourNum, 10);
        var minute = parseInt(minuteNum, 10);
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // task name
        this.schedulerData.days[day].events[event].event.taskName = task;
        // task active
        if ( taskActive == 1)           // enum Yes
            this.schedulerData.days[day].events[event].event.taskActive = 1;
        else if ( taskActive == 2 )     // enum No
            this.schedulerData.days[day].events[event].event.taskActive = 0;
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // time - hour
        aux = parseInt(this.schedulerData.days[day].events[event].event.hour, 10);
        if ( hourOperator == 1 )        // enum = / value received is what is wanted
            aux = hour;
        else if ( hourOperator == 2 )   // enum + / value received increments current
        {   aux += hour;
            if ( aux > 23 )
                aux -= 23;
        }
        else if ( hourOperator == 3 )   // enum - / value received decrements current
        {   aux -= hour;
            if ( aux < 0 )
                aux += 23;
        }
        this.schedulerData.days[day].events[event].event.hour = aux;
        // time - minute
        aux = parseInt(this.schedulerData.days[day].events[event].event.minute, 10);
        if ( minuteOperator == 1 )        // =
            aux = minute;
        else if ( minuteOperator == 2 )   // +
        {   aux += minute;
            if ( aux > 59 )
                aux -= 59;
        }
        else if ( minuteOperator == 3 )   // -
        {   aux -= minute;
            if ( aux < 0 )
                aux += 59;
        }
        this.schedulerData.days[day].events[event].event.minute = aux;
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // update gui
        this._update_gui( day, event );
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // to json string => save to persistent string variable
        var j = JSON.stringify( this.schedulerData );
        QMedialon.SetValue( this.Setup.stringVarName, j );
        return "set event";
    },
    //*************************************************************************
    //  5b - PRIVATE FUNCTIONS
    //*************************************************************************
    _start: function(){
        // call loop for ever, every interval var
        if ( this.Setup.interval == 0 )        // enum 5
            this.Setup.interval = 5
        else if ( this.Setup.interval == 1 )   // enum 15
            this.Setup.interval = 15
        else if ( this.Setup.interval == 2 )   // enum 30
            this.Setup.interval = 30  
        // in miliseconds      
        this.Setup.interval *= 1000;
        // set interval to call
        QMedialon.SetInterval(this._loop_for_ever, this.Setup.interval );
    },
    //*************************************************************************
    //  LOOP FOR EVER
    _loop_for_ever: function(){
        // led on
        QMedialon.SetValue( "LED_interval.Status", 2 );
        // led off after 500 miliseconds
        QMedialon.SetTimeout(this._led_off, 500);
        // get current weekday and time from medialon
        var day = QMedialon.GetValueAsInteger( "Manager.CurrentDay" );
        var hourNow = parseInt(QMedialon.GetValueAsString( "Manager.CurrentTime" ).slice(0,2), 10);
        var minuteNow = parseInt(QMedialon.GetValueAsString( "Manager.CurrentTime" ).slice(3,5), 10);
        // check if this minute has already checked
        if ( minuteNow != this.minuteCurrent ){
            // save as already checked
            this.minuteCurrent = minuteNow;
            var event;
            // loop over present day data
            for ( event=0; event<this.EVENTS_BY_DAY; event++ ){
                // same hour?
                if ( hourNow == this.schedulerData.days[day].events[event].event.hour ){
                    // same minute?
                    if ( minuteNow == this.schedulerData.days[day].events[event].event.minute ){
                        // is the task marked as active?
                        if ( this.schedulerData.days[day].events[event].event.taskActive == 1 ){
                            // yes: update var + start task
                            this.Device.eventNumber = event;
                            QMedialon.StartTask( this.schedulerData.days[day].events[event].event.taskName );
                        }
                    }
                }
            }
        }
    },
    //*************************************************************************
    //  LOAD DATA OBJECT
    _init_load_data : function() {
        var i, j;
        var data = QMedialon.GetValueAsString( this.Setup.stringVarName );
        if ( data != "" )
        {   // check is a json string
            try {
                this.schedulerData = JSON.parse(data);
            }
            catch(e) {
                this.Device.lastError = this.error_no_json;
            }
            this._init_gui_data();
        }
        else
        {   this.init_new_data();
        }
    },
    //*************************************************************************
    // INIT NEW DATA OBJECT ( Clear All Data )
    init_new_data : function() {
        // build the event objects inside one array events
        var events = []
        for ( i=0; i<this.EVENTS_BY_DAY; i++)
        {   events[i] = {};
            events[i].event = {};
            events[i].event.taskName = "";
            events[i].event.taskActive = 0;
            events[i].event.hour = 0;
            events[i].event.minute = 0;
        }
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // build weekdays with the array events
        this.schedulerData.days = [];
        for ( i=0; i<this.DAYS_NUMBER; i++ )
        {   this.schedulerData.days[i] = {};
            this.schedulerData.days[i].events = events;
        }
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // save: to json string => save to persistent variable
        var j = JSON.stringify( this.schedulerData );
        QMedialon.SetValue( this.Setup.stringVarName, j );
        // udata all gui
        this._init_gui_data();
    },
    //*************************************************************************
    //  UPDATE GUI - ALL DAYS
    _init_gui_data : function() {
        // update all gui 
        for ( i=0; i<this.DAYS_NUMBER; i++ )
        {   for ( j=0; j<this.EVENTS_BY_DAY; j++)
                this._update_gui( i, j );
        }
    },
    //*************************************************************************
    //  UPDATE GUI - ONE EVENT
    _update_gui: function( day, event ){
        // time
        var hour = this.schedulerData.days[day].events[event].event.hour;
        if ( hour < 10 )
            hour = '0' + hour;
        var min = this.schedulerData.days[day].events[event].event.minute;
        if ( min < 10 )
            min = '0' + min;
        var time = hour + " : " + min;
        var TXT = "TXT_day" + day + "_event" + event + "_time.Text";
        QMedialon.SetValue( TXT, time );
        // led task active - enum "Not Change"(0), "Yes"(1), "No"(2) - led 0: black / 2: green
        var act = this.schedulerData.days[day].events[event].event.taskActive;
        if ( act == 1 )
        {    // check task name is not empty
            if ( this.schedulerData.days[day].events[event].event.taskName != "" )
                act = 2;        // led green
            else
                act = 0;        // led black
        }
        else if ( act == 2 )
            act = 0;            // led black
        var LED = "LED_day" + day + "_event" + event + "_active.Status";
        QMedialon.SetValue( LED, act );
    },
    //*************************************************************************
    //  LED OFF
    _led_off: function(){
        // led off
        QMedialon.SetValue( "LED_interval.Status", 0 );
    },
    //*************************************************************************
    //  STARTUP FUNCTION
    _mStart : function() {
        // led off
        this._led_off();
        // load data
        this._init_load_data();
        // wait for 20 seconds to start the loop for ever
        QMedialon.SetTimeout(this._start, 20000);
    },
// 6. Script Ends
}) 