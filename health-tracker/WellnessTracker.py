#Testing the git method

#Basic structure for this - 
#Start with access to a created csv file. It must be in the same folder as the program
#The first method will deal with a simple text-based interface asking the user which task they wish
#to complete.

#Our imports:
from datetime import datetime
import pandas as pd

#Our global variables (we can change these later)
userName = "Conor"



#Welcoming function
#input: nothing
#output: nothing, calls the next method based on what the user wants to do
def welcome() :
    #open and set up our dataframes
    #tracker = pd.read_csv(r'C:\Users\cbabc\Desktop\Personal Projects 2026\WellnessChart.csv')
    tracker = pd.read_csv('WellnessChart.csv')
    #Our tracker has been read into correctly

    anomalyTracker = pd.read_csv('Anomalies.csv')


    curHour = datetime.now().hour

    if 11 >= curHour >= 4 :
        print("Good morning, " + userName + ".")
    elif 12 <= curHour <= 18 :
        print("Good afternoon, " + userName + ".")
    else :
        print("Good evening, " + userName + ".")
    
    print("What would you like to do today?")
    print("[1] Log your daily check-in status")
    print("[2] Log an anomaly")
    print("[3] Edit an existing day entry")
    print("[4] Visualize data")
    print("[5] Check rewards progress")

    userChoice = input()
    #cast this to an integer. For now we assume correct/sanitized inputs.
    userChoice = int(userChoice)
    if userChoice == 1 : 
        dailyCheckIn(tracker)
    elif userChoice == 2 :
        anomalyLogger(anomalyTracker)

    #Run our different routines for the different inputs

    #Input one - daily check-in

def dailyCheckIn(tracker) :
    weekday = datetime.now().strftime("%A")
    #set up the date

    dateString = datetime.now().strftime("%Y-%m-%d")

    
    
    print("Happy " + weekday + ", " + userName + ".")
    print("How are you feeling today? Let's check in.")
    print("For how many hours last night did you sleep?")
    hoursSlept = float(input())
    print("And how would you describe the quality of that sleep, on a scale of 1-10?")
    sleepQuality = int(input())
    print("How long (in hours) did it take you to fall asleep?")
    timeToSleep = float(input())
    print("How severe is your headache, on a scale of 1-10?")
    headacheSeverity = int(input())
    print("How severe is the visual distortion, on a scale of 1-10?")
    distortionSeverity = int(input())
    print("How well did you eat today, on a scale from 1-10?")
    mealQuality = int(input())
    print("What exercise did you complete today? (You cannot use commas)")
    workout = input()

    daily_entry = {
        "Date": dateString,
        "Hours_Of_Sleep": hoursSlept,
        "Quality_Of_Sleep": sleepQuality,
        "Time_To_Fall_Asleep": timeToSleep,
        "Headache_Severity": headacheSeverity,
        "Distortion_Severity": distortionSeverity,
        "Meal_Quality": mealQuality,
        "Exercise_Completed": workout,
        "Anomaly": False
        }    
    print(daily_entry)
    tracker = pd.concat([tracker, pd.DataFrame([daily_entry])], ignore_index=True)

    # Save back at end of session
    tracker.to_csv('WellnessChart.csv', index=False)

#input two - anomaly logger
def anomalyLogger(anomalyTracker) :
    print("I'm sorry there's an anomaly. What would you like to record?")
    print("Anomaly Type: (type exactly as the following - Headache, HPPD General, Eye Blur, Loud Music, Dizziness, Exhaustion)")
    anomalyType = input()
    print("What is the severity, on a scale of one to ten?")
    severity = int(input())
    print("How long has it been since the start?")
    length = float(input())
    print("What have you attempted as a mitigation measure? (No commas)")
    mitigation = input()

    anomaly_Entry = {
        "Anomaly_Type" : anomalyType,
        "Severity" : severity,
        "Length_Since_Start" : length,
        "Mitigation_Measures" : mitigation
    }

    print(anomaly_Entry)

    anomalyTracker = pd.concat([anomalyTracker, pd.DataFrame([anomaly_Entry])], ignore_index=True)

    # Save back at end of session
    anomalyTracker.to_csv('Anomalies.csv', index=False)

#run our program
welcome()
