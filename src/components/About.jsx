function About(props){


    return(

        <section className="about">

            <h2>
                About Me
            </h2>


            <p>
                Hello, I am {props.name}.
                I am a {props.role}.
                I love building AI and Machine Learning based applications.
            </p>


            <p>
                Currently pursuing Artificial Intelligence 
                and Machine Learning engineering.
            </p>


        </section>

    );

}


export default About;